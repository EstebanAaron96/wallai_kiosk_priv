import { useEffect, useState } from 'react';
import type { KioskConfig } from '../types/KioskConfig';
import type { PlantHistoryPoint } from '../types/PlantData';
import { fetchHistory } from '../api/kioskClient';

const POLL_INTERVAL_MS = 5 * 60_000;

export interface UseKioskHistoryResult {
  points: PlantHistoryPoint[];
  error: string | null;
}

function todayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { start, end: now };
}

/** Histórico del día en curso (00:00 -> ahora), refrescado cada 5 minutos. */
export function useKioskHistory(config: KioskConfig | null): UseKioskHistoryResult {
  const [points, setPoints] = useState<PlantHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const { start, end } = todayRange();
        const history = await fetchHistory(config, start, end);
        if (cancelled) return;

        const { formatted_labels, solar_output, grid_consumption } = history.variables_data;
        const normalized: PlantHistoryPoint[] = formatted_labels.map((timestamp, i) => ({
          timestamp,
          solarOutputKw: solar_output[i] ?? 0,
          gridConsumptionKw: grid_consumption[i] ?? 0,
        }));

        setPoints(normalized);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error desconocido obteniendo histórico de la planta.');
        // Se mantiene el histórico previo en pantalla, no se vacía `points`.
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [config]);

  return { points, error };
}
