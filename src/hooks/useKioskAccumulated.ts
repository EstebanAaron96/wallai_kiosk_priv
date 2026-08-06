import { useEffect, useState } from 'react';
import type { KioskConfig } from '../types/KioskConfig';
import { fetchPlantStatistics } from '../api/kioskClient';

const POLL_INTERVAL_MS = 10 * 60_000;
// El backend limita get_plant_statistics a 1 petición/20s por token de
// kiosco (mismo scope para cualquier rango de fechas). Como pedimos año y
// mes con dos llamadas al mismo endpoint, hay que espaciarlas o la segunda
// vuelve 429.
const THROTTLE_GAP_MS = 21_000;

export interface AccumulatedPeriod {
  percentSolar: number;
  solarKwh: number;
  gridKwh: number;
}

export interface UseKioskAccumulatedResult {
  year: AccumulatedPeriod | null;
  month: AccumulatedPeriod | null;
  error: string | null;
}

function startOfYear(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function startOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deriva el % de autoconsumo fotovoltaico y el reparto FV/Red en kWh a partir
 * de los KPIs (house_consumption + *_consumption_percentage), replicando el
 * cálculo real del backend (ver metrics.py: safe_pct(E_PV_load, E_CONS) y
 * safe_pct(E_Grid_load, E_CONS), ambos en escala 0-100).
 */
function toPeriod(kpis: { house_consumption: number; photovoltaic_consumption_percentage: number }): AccumulatedPeriod {
  return {
    percentSolar: kpis.photovoltaic_consumption_percentage,
    solarKwh: (kpis.house_consumption * kpis.photovoltaic_consumption_percentage) / 100,
    gridKwh: (kpis.house_consumption * (100 - kpis.photovoltaic_consumption_percentage)) / 100,
  };
}

/** Autoconsumo acumulado del año y del mes en curso, refrescado cada 10 minutos. */
export function useKioskAccumulated(config: KioskConfig | null): UseKioskAccumulatedResult {
  const [year, setYear] = useState<AccumulatedPeriod | null>(null);
  const [month, setMonth] = useState<AccumulatedPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const now = new Date();
      let lastError: string | null = null;

      try {
        const yearStats = await fetchPlantStatistics(config, startOfYear(now), now);
        if (cancelled) return;
        setYear(toPeriod(yearStats));
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Error desconocido obteniendo el acumulado anual.';
      }

      if (cancelled) return;
      await sleep(THROTTLE_GAP_MS);
      if (cancelled) return;

      try {
        const monthStats = await fetchPlantStatistics(config, startOfMonth(now), now);
        if (cancelled) return;
        setMonth(toPeriod(monthStats));
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Error desconocido obteniendo el acumulado mensual.';
      }

      if (cancelled) return;
      setError(lastError);
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [config]);

  return { year, month, error };
}
