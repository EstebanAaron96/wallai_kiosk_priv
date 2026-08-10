import { totalGeneration, type EnergySnapshot } from '../data/types.ts'
import type { EnergyFlowField, FlowDrive } from './energy-flow.ts'
import type { FlowId } from './flow-curves.ts'

/**
 * Translates one telemetry snapshot into what each flow should be doing.
 *
 * The plant is modelled as a single point of connection: all photovoltaic output
 * reaches the building's bus, and the grid link carries whatever is left over —
 * importing when the panels fall short, exporting the surplus otherwise. That is
 * why `grid-load` is one reversible flow rather than two.
 */
export interface FlowPalette {
  solar: string
  grid: string
}

export function drivesFromSnapshot(
  snapshot: EnergySnapshot,
  flowColors: FlowPalette,
): Record<FlowId, FlowDrive> {
  const generation = totalGeneration(snapshot)
  const exporting = snapshot.red_kW < 0

  return {
    // Spurs carry their own array. PV1 ties into the PV3 run, so that branch
    // carries both from the tie point on; the trunk carries everything.
    pv1: { power: snapshot.generacion_pv1_kW, direction: 1, color: flowColors.solar },
    pv2: { power: snapshot.generacion_pv2_kW, direction: 1, color: flowColors.solar },
    pv3: {
      power: (snapshot.generacion_pv3_kW ?? 0) + snapshot.generacion_pv1_kW,
      direction: 1,
      color: flowColors.solar,
    },
    'pv-to-load': { power: generation, direction: 1, color: flowColors.solar },
    'grid-load': {
      power: Math.abs(snapshot.red_kW),
      // The route runs Grid → Load, so importing is forwards and exporting reverses it.
      direction: exporting ? -1 : 1,
      // Surplus leaving the building is solar energy, so it keeps the solar colour.
      color: exporting ? flowColors.solar : flowColors.grid,
    },
  }
}

export function applySnapshot(
  flows: EnergyFlowField,
  snapshot: EnergySnapshot,
  flowColors: FlowPalette,
): void {
  const drives = drivesFromSnapshot(snapshot, flowColors)
  for (const [id, drive] of Object.entries(drives)) {
    flows.drive(id as FlowId, drive)
  }
}
