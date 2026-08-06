import { useEffect, useRef, useState } from 'react';
import type { KioskConfig } from '../types/KioskConfig';
import type { PlantSnapshot } from '../types/PlantData';
import { fetchCurrentSnapshot } from '../api/kioskClient';

// Mongo solo se sincroniza cada 5 minutos, en minutos ≡ 2 (mod 5): xx:02,
// xx:07, xx:12... Pedir cada 30s (como hacíamos antes) solo repetía el mismo
// dato 9 de cada 10 veces. En vez de un intervalo fijo, alineamos cada
// petición a la siguiente marca de sincronización (+ margen de seguridad).
const SYNC_INTERVAL_MIN = 5;
const SYNC_OFFSET_MIN = 2;
const SYNC_BUFFER_MS = 15_000;
// Tolerancia de "dato obsoleto": algo más que un ciclo de sincronización
// completo, para no marcar `isStale` en cada ciclo normal por un pequeño
// desfase de red.
const STALE_AFTER_MS = (SYNC_INTERVAL_MIN + 2) * 60_000;

export interface UseKioskDataResult {
  data: PlantSnapshot | null;
  error: string | null;
  lastUpdated: Date | null;
  /** true si no hemos conseguido un dato fresco en más de un ciclo de sincronización. */
  isStale: boolean;
}

/** Milisegundos hasta la próxima marca de sincronización de Mongo (+ margen). */
function msUntilNextSync(now: Date): number {
  const epochMin = Math.floor(now.getTime() / 60_000);
  const phase = ((epochMin % SYNC_INTERVAL_MIN) - SYNC_OFFSET_MIN + SYNC_INTERVAL_MIN) % SYNC_INTERVAL_MIN;
  const minutesUntilMark = (SYNC_INTERVAL_MIN - phase) % SYNC_INTERVAL_MIN;

  const mark = new Date(now);
  mark.setSeconds(0, 0);
  mark.setMinutes(mark.getMinutes() + minutesUntilMark);

  let target = mark.getTime() + SYNC_BUFFER_MS;
  if (target <= now.getTime()) target += SYNC_INTERVAL_MIN * 60_000;
  return target - now.getTime();
}

/**
 * Poll del snapshot actual de la planta, alineado a los ciclos de
 * sincronización de Mongo (cada 5 minutos) en vez de un intervalo fijo. Si un
 * fetch falla, se conserva el último valor válido en pantalla (nunca se
 * limpia `data` por un error transitorio) y se marca el error para uso
 * informativo/depuración.
 */
export function useKioskData(config: KioskConfig | null): UseKioskDataResult {
  const [data, setData] = useState<PlantSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  const lastUpdatedRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const snapshot = await fetchCurrentSnapshot(config);
        if (cancelled) return;
        const now = new Date();
        lastUpdatedRef.current = now;
        setData(snapshot);
        setLastUpdated(now);
        setError(null);
        setIsStale(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error desconocido obteniendo datos de la planta.');
        // No se toca `data`: se mantiene el último snapshot válido en pantalla.
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(poll, msUntilNextSync(new Date()));
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [config]);

  // Comprueba periódicamente si el último dato válido se ha quedado obsoleto,
  // independientemente de si el polling en curso está fallando o no.
  useEffect(() => {
    const intervalId = setInterval(() => {
      const last = lastUpdatedRef.current;
      setIsStale(last !== null && Date.now() - last.getTime() > STALE_AFTER_MS);
    }, 10_000);
    return () => clearInterval(intervalId);
  }, []);

  return { data, error, lastUpdated, isStale };
}
