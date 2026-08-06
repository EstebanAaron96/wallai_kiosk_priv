import { useEffect, useState } from 'react';
import type { KioskConfig } from '../types/KioskConfig';
import { decodeKioskTokenPlantId } from '../api/jwt';

export interface UseKioskConfigResult {
  config: KioskConfig | null;
  isLoading: boolean;
  error: string | null;
}

function validate(raw: unknown): KioskConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('config.json no contiene un objeto JSON válido.');
  }
  const candidate = raw as Partial<KioskConfig>;

  if (typeof candidate.apiBaseUrl !== 'string' || candidate.apiBaseUrl.trim() === '') {
    throw new Error('config.json no define "apiBaseUrl" (o está vacío).');
  }
  if (typeof candidate.kioskToken !== 'string' || candidate.kioskToken.trim() === '') {
    throw new Error('config.json no define "kioskToken" (o está vacío).');
  }

  // Falla pronto y con un mensaje claro si el token no es un JWT de kiosco
  // válido, en vez de dejar que cada llamada a la API falle más tarde.
  decodeKioskTokenPlantId(candidate.kioskToken);

  return {
    apiBaseUrl: candidate.apiBaseUrl,
    kioskToken: candidate.kioskToken,
    plantLabel: typeof candidate.plantLabel === 'string' ? candidate.plantLabel : undefined,
  };
}

/**
 * Carga /config.json (servido junto al build estático, fuera del bundle) y
 * lo valida. Se ejecuta una sola vez al montar la app.
 */
export function useKioskConfig(): UseKioskConfigResult {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/config.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`No se pudo cargar config.json (HTTP ${response.status}).`);
        }
        const raw = await response.json();
        const validated = validate(raw);
        if (!cancelled) {
          setConfig(validated);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido cargando config.json.');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, isLoading, error };
}
