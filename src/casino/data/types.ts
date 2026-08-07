/**
 * Wire format the 3D scene/UI consume, ported as-is from the Casino design
 * (src/data/types.ts). Field names are the Spanish ones the scene modules
 * already expect — kept unchanged so scene/ui code needed zero edits.
 */
export interface EnergySnapshot {
  /**
   * Exchange with the grid, signed:
   *   > 0  importing (grid → building)
   *   < 0  exporting (surplus → grid)
   */
  red_kW: number
  generacion_pv1_kW: number
  generacion_pv2_kW: number
  consumo_kW: number
  acumulado_anual: AccumulatedEnergy
  acumulado_mes: AccumulatedEnergy & { mes: string }
}

export interface AccumulatedEnergy {
  fotovoltaica_kWh: number
  red_kWh: number
}

/** Total photovoltaic output across both rows. */
export function totalGeneration(snapshot: EnergySnapshot): number {
  return snapshot.generacion_pv1_kW + snapshot.generacion_pv2_kW
}

/** True while the plant is pushing surplus back into the grid. */
export function isExporting(snapshot: EnergySnapshot): boolean {
  return snapshot.red_kW < 0
}

/** Share of consumption covered by the plant itself, 0..1. */
export function solarShare(accumulated: AccumulatedEnergy): number {
  const total = accumulated.fotovoltaica_kWh + accumulated.red_kWh
  return total > 0 ? accumulated.fotovoltaica_kWh / total : 0
}
