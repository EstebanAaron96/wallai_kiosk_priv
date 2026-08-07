import { CurvePath, LineCurve3, Object3D, QuadraticBezierCurve3, Vector3, type Curve } from 'three'

/**
 * Flow routing.
 *
 * The Blender Empties mark endpoints, not paths, so the route between them is
 * generated here. Runs are axis-aligned with rounded corners — the way a real
 * conduit or cable tray is laid — rather than free arcs: it reads as an
 * electrical schematic, which is what the screen is actually showing.
 *
 * Corners are quadratic Béziers whose control point is the sharp corner itself
 * and whose ends sit one radius back along each leg. That is tangent-continuous
 * with both straight runs by construction, so the tube never kinks.
 */
export type FlowId = 'pv1' | 'pv2' | 'pv-to-load' | 'grid-load'

/** Axis order to travel in: 'x' means "move until X matches the target". */
export type Axis = 'x' | 'y' | 'z'

export interface RouteSpec {
  id: FlowId
  label: string
  from: string
  to: string
  /**
   * Order of axis-aligned moves from origin to destination. `['z', 'x']` runs
   * along Z first, turns, then runs along X.
   */
  legs: readonly Axis[]
  /**
   * Routes the run at this height above the higher of the two endpoints, then
   * drops onto the target. Relative rather than absolute so it survives the
   * model moving: a roof run laid flat on the roof is simply invisible.
   */
  liftAbove?: number
  /** Corner radius in world units; clamped to half the shortest adjacent leg. */
  cornerRadius?: number
}

export const ROUTES: readonly RouteSpec[] = [
  // Roof runs: lifted clear of the roof, along the ridge, then west to the junction.
  { id: 'pv1', label: 'Fila PV1 → Punto de unión', from: 'PV1', to: 'PV-Juntas', legs: ['z', 'x', 'y'], liftAbove: 0.14 },
  { id: 'pv2', label: 'Fila PV2 → Punto de unión', from: 'PV2', to: 'PV-Juntas', legs: ['z', 'x', 'y'], liftAbove: 0.14 },
  // Out to the facade line, then straight down — a riser.
  { id: 'pv-to-load', label: 'Punto de unión → Consumo', from: 'PV-Juntas', to: 'Load', legs: ['x', 'z', 'y'] },
  // Straight along the ground from the substation, then up into the building.
  { id: 'grid-load', label: 'Red eléctrica ↔ Consumo', from: 'Grid', to: 'Load', legs: ['z', 'x', 'y'] },
] as const

export interface FlowCurve {
  id: FlowId
  label: string
  curve: Curve<Vector3>
  from: Vector3
  to: Vector3
  length: number
}

export class MissingWaypointError extends Error {
  readonly routeId: FlowId
  readonly waypoint: string

  constructor(routeId: FlowId, waypoint: string) {
    super(`La ruta "${routeId}" necesita el Empty "${waypoint}", que no está en el GLB`)
    this.name = 'MissingWaypointError'
    this.routeId = routeId
    this.waypoint = waypoint
  }
}

/** Corner points of the axis-aligned route, with zero-length moves dropped. */
function orthogonalCorners(from: Vector3, to: Vector3, spec: RouteSpec): Vector3[] {
  const points: Vector3[] = [from.clone()]
  const cursor = from.clone()

  const push = (): void => {
    const last = points[points.length - 1]!
    if (last.distanceToSquared(cursor) > 1e-8) points.push(cursor.clone())
  }

  if (spec.liftAbove !== undefined) {
    cursor.y = Math.max(from.y, to.y) + spec.liftAbove
    push()
  }

  for (const axis of spec.legs) {
    cursor[axis] = to[axis]
    push()
  }

  cursor.copy(to)
  push()
  return points
}

/**
 * Turns a corner polyline into straight segments joined by rounded fillets.
 * The radius shrinks automatically where two corners crowd each other, so a
 * short leg between two turns still produces a clean shape instead of
 * overlapping arcs.
 */
function buildRoundedPath(corners: Vector3[], radius: number): CurvePath<Vector3> {
  const path = new CurvePath<Vector3>()
  if (corners.length < 2) return path

  let cursor = corners[0]!.clone()

  for (let i = 1; i < corners.length - 1; i += 1) {
    const corner = corners[i]!
    const next = corners[i + 1]!

    const incoming = new Vector3().subVectors(corner, cursor)
    const outgoing = new Vector3().subVectors(next, corner)
    const incomingLength = incoming.length()
    const outgoingLength = outgoing.length()
    if (incomingLength < 1e-6 || outgoingLength < 1e-6) continue

    // Never eat more than half of either leg, or consecutive fillets overlap.
    const fillet = Math.min(radius, incomingLength / 2, outgoingLength / 2)

    const arcStart = new Vector3().copy(corner).addScaledVector(incoming.normalize(), -fillet)
    const arcEnd = new Vector3().copy(corner).addScaledVector(outgoing.normalize(), fillet)

    if (cursor.distanceToSquared(arcStart) > 1e-8) path.add(new LineCurve3(cursor.clone(), arcStart))
    path.add(new QuadraticBezierCurve3(arcStart, corner.clone(), arcEnd))
    cursor = arcEnd
  }

  const end = corners[corners.length - 1]!
  if (cursor.distanceToSquared(end) > 1e-8) path.add(new LineCurve3(cursor, end.clone()))

  return path
}

export interface BuildOptions {
  /** Default corner radius, in world units. */
  cornerRadius?: number
}

export function buildFlowCurves(
  empties: Map<string, Object3D>,
  routes: readonly RouteSpec[] = ROUTES,
  options: BuildOptions = {},
): FlowCurve[] {
  const { cornerRadius = 0.09 } = options

  return routes.map((spec) => {
    const fromNode = empties.get(spec.from)
    const toNode = empties.get(spec.to)
    if (!fromNode) throw new MissingWaypointError(spec.id, spec.from)
    if (!toNode) throw new MissingWaypointError(spec.id, spec.to)

    const from = fromNode.getWorldPosition(new Vector3())
    const to = toNode.getWorldPosition(new Vector3())

    const corners = orthogonalCorners(from, to, spec)
    const curve = buildRoundedPath(corners, spec.cornerRadius ?? cornerRadius)

    return { id: spec.id, label: spec.label, curve, from, to, length: curve.getLength() }
  })
}
