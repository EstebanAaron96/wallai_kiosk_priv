import type { KioskConfig } from '../types/KioskConfig';
import type { PlantHistoryResponse, PlantKPIs, PlantSnapshot, StaticDataResponse } from '../types/PlantData';
import { decodeKioskTokenPlantId } from './jwt';
import { ApiError } from './errors';

function buildUrl(config: KioskConfig, path: string, params: Record<string, string | number>): string {
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  const url = new URL(base + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

async function kioskFetch(url: string, config: KioskConfig): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.kioskToken}`,
        Accept: 'application/json',
      },
    });
  } catch (networkError) {
    throw new ApiError(
      `No se pudo contactar con el backend (${(networkError as Error).message}).`,
      null,
    );
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new ApiError(
        'El backend rechazó el token de kiosco para esta planta (403). Puede haber sido revocado.',
        403,
      );
    }
    throw new ApiError(`El backend respondió con un error (${response.status}).`, response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError('La respuesta del backend no es JSON válido.', response.status);
  }
}

/** Formatea una Date como "YYYY-MM-DD", el formato que espera el backend. */
function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchCurrentSnapshot(config: KioskConfig): Promise<PlantSnapshot> {
  const plantId = decodeKioskTokenPlantId(config.kioskToken);
  const url = buildUrl(config, '/api/data/get_data_static/', { plant_id: plantId });
  const body = (await kioskFetch(url, config)) as StaticDataResponse;

  const plant = body.static_info?.[0];
  if (!plant) {
    throw new ApiError('El backend no devolvió datos para la planta del kiosco.', null);
  }
  return plant;
}

export async function fetchHistory(
  config: KioskConfig,
  startDate: Date,
  endDate: Date,
): Promise<PlantHistoryResponse> {
  const plantId = decodeKioskTokenPlantId(config.kioskToken);
  const url = buildUrl(config, '/api/data/get_data/', {
    plant_id: plantId,
    start_date: toDateParam(startDate),
    end_date: toDateParam(endDate),
  });
  return (await kioskFetch(url, config)) as PlantHistoryResponse;
}

/**
 * KPIs agregados de un rango de fechas (p.ej. todo un año) sin la serie
 * temporal completa de get_data — mucho más rápido para rangos largos, ya
 * que get_data calcula el flujo minuto a minuto de todo el rango.
 */
export async function fetchPlantStatistics(
  config: KioskConfig,
  startDate: Date,
  endDate: Date,
): Promise<PlantKPIs> {
  const plantId = decodeKioskTokenPlantId(config.kioskToken);
  const url = buildUrl(config, '/api/data/get_plant_statistics/', {
    plant_id: plantId,
    start_date: toDateParam(startDate),
    end_date: toDateParam(endDate),
  });
  return (await kioskFetch(url, config)) as PlantKPIs;
}
