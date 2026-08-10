/**
 * Wire format of the plant telemetry.
 *
 * Field names are intentionally the Spanish ones from the API contract — this is
 * the one place where the backend's vocabulary wins over the codebase's English,
 * because the shape has to survive being swapped for a real WebSocket/REST feed
 * without touching anything downstream.
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
  /**
   * Third array, added when the model grew a third origin point. Optional so a
   * feed that only reports two strings still satisfies the contract — it simply
   * reads as zero and that flow fades out.
   */
  generacion_pv3_kW?: number
  consumo_kW: number
  acumulado_anual: AccumulatedEnergy
  acumulado_mes: AccumulatedEnergy & { mes: string }
}

export interface AccumulatedEnergy {
  fotovoltaica_kWh: number
  red_kWh: number
}

export type SnapshotListener = (snapshot: EnergySnapshot) => void

/**
 * Everything downstream depends only on this. Replacing the simulator with a
 * live feed means writing another implementation of this interface — the scene,
 * the labels and the charts stay untouched.
 */
export interface EnergySource {
  /** Latest value, or null before the first one arrives. */
  getSnapshot(): EnergySnapshot | null
  /** Returns an unsubscribe function. */
  subscribe(listener: SnapshotListener): () => void
  start(): void
  stop(): void
}

/** Total photovoltaic output across every array. */
export function totalGeneration(snapshot: EnergySnapshot): number {
  return snapshot.generacion_pv1_kW + snapshot.generacion_pv2_kW + (snapshot.generacion_pv3_kW ?? 0)
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
