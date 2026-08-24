import type { EnergySnapshot } from './data/types.ts'
import type { PlantSnapshot } from '../types/PlantData.ts'
import type { AccumulatedPeriod } from '../hooks/useKioskAccumulated.ts'
import { nowInCanary } from '../utils/canaryTime.ts'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function toAccumulated(period: AccumulatedPeriod | null): { fotovoltaica_kWh: number; red_kWh: number } {
  return { fotovoltaica_kWh: period?.solarKwh ?? 0, red_kWh: period?.gridKwh ?? 0 }
}

/**
 * Maps the real backend fields wallai_kiosk already fetches (PlantSnapshot +
 * AccumulatedPeriod) onto the wire format the ported Casino scene/UI expect.
 *
 * Two approximations, both because the backend doesn't expose what the 3D
 * model's three physical PV rows need:
 * - red_kW: the backend gives a signless magnitude (gridKw) plus direction
 *   flags (rc importing / pr exporting); this converts that into the signed
 *   value the scene's single reversible Grid<->Load route expects.
 * - generacion_pv1_kW / pv2_kW / pv3_kW: the backend only reports total PV
 *   output, not per-row — split evenly across all three scene routes.
 */
export function toEnergySnapshot(
  plant: PlantSnapshot,
  year: AccumulatedPeriod | null,
  month: AccumulatedPeriod | null,
): EnergySnapshot {
  const flow = plant.energy_flow_data
  const redKw = flow ? (flow.rc ? flow.gridKw : flow.pr ? -flow.gridKw : 0) : 0
  const pvShare = (flow?.pvKw ?? 0) / 3

  return {
    red_kW: redKw,
    generacion_pv1_kW: pvShare,
    generacion_pv2_kW: pvShare,
    generacion_pv3_kW: pvShare,
    consumo_kW: flow?.loadKw ?? 0,
    acumulado_anual: toAccumulated(year),
    acumulado_mes: { mes: MONTHS[nowInCanary().getMonth()] ?? '', ...toAccumulated(month) },
  }
}
