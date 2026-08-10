import { CurvePath, LineCurve3, Object3D, QuadraticBezierCurve3, Vector3, type Curve } from 'three'

/**
 * Flow routing.
 *
 * A route is an ordered list of Empties. Between each consecutive pair the path
 * is laid out axis-aligned with rounded corners, the way a conduit or cable tray
 * actually runs. Where two Empties are already aligned on an axis the generated
 * legs collapse to a single straight segment, so a hand-authored orthogonal chain
 * in Blender comes through exactly as drawn.
 *
 * Corners are quadratic Béziers whose control point is the sharp corner and whose
 * ends sit one radius back along each leg — tangent-continuous with both straight
 * runs by construction, so the tube never kinks.
 */
export type FlowId = 'pv1' | 'pv2' | 'pv3' | 'pv-to-load' | 'grid-load'

/** Axis order to travel in: 'x' means "move until X matches the next point". */
export type Axis = 'x' | 'y' | 'z'

/**
 * Entries in `through` accept three suffixes/forms, so the route survives the
 * model being edited without the code having to keep up:
 *
 *   `Name*`       expands to its numbered chain — `PV-Juntas`, `PV-Juntas.001`,
 *                 `PV-Juntas.002`… in numeric order. Adding a waypoint in Blender
 *                 needs no change here, which is the whole point: the route is
 *                 drawn in the model, not written in the code.
 *   `Name?`       included only if it exists. Lets a new waypoint be introduced
 *                 in Blender before or after the code knows about it.
 *   `A|B`         the first of these that exists. Used where a route has to end
 *                 at "the head of the junction", whatever it is currently called.
 */
export interface RouteSpec {
  id: FlowId
  label: string
  through: readonly string[]
  /** Axis order used to bridge any pair that is not already aligned. */
  legs: readonly Axis[]
  /**
   * Routes the first hop this far above the higher of its two ends, then drops
   * onto the target. Relative to the scene, so it survives the model moving:
   * a roof run laid flat on the roof is simply invisible.
   */
  liftAbove?: number
  /** Corner radius in world units; clamped to half the shortest adjacent leg. */
  cornerRadius?: number
}

/**
 * The plant's wiring, as laid out in the model:
 *
 *   PV1 ──┐
 *         ├─→ PV3.001 ──┐
 *   PV3 ──┘             ├─→ PV-Juntas-previa ─→ PV-Juntas ─→ .001 → .002 → .003 ─→ Load
 *   PV2 ────────────────┘        (one trunk carrying the whole plant's output)
 *
 *   Grid ←─────────────────────────────────────────────────────────────────────→ Load
 *
 * PV1 and PV3 tie in at PV3.001 and travel on together; PV2 runs to the
 * pre-junction on its own. Everything leaves the pre-junction on one trunk, which
 * therefore carries the combined generation rather than any single array's.
 */
export const ROUTES: readonly RouteSpec[] = [
  /** `A|B` picks the pre-junction if the model has one, else the junction itself. */
  {
    id: 'pv1',
    label: 'PV1 → PV3.001',
    through: ['PV1', 'PV3.001|PV3001'],
    legs: ['x', 'y', 'z'],
  },
  {
    id: 'pv2',
    label: 'PV2 → Punto de unión',
    through: ['PV2', 'PV-Juntas-previa|PV-Juntas'],
    legs: ['x', 'y', 'z'],
  },
  {
    id: 'pv3',
    label: 'PV3 → Punto de unión',
    through: ['PV3*', 'PV-Juntas-previa|PV-Juntas'],
    legs: ['z', 'x', 'y'],
  },
  {
    id: 'pv-to-load',
    label: 'Punto de unión → Consumo',
    through: ['PV-Juntas-previa?', 'PV-Juntas*', 'Load'],
    legs: ['z', 'x', 'y'],
  },
  // Straight along the ground from the substation, then up into the building.
  { id: 'grid-load', label: 'Red eléctrica ↔ Consumo', through: ['Grid', 'Load'], legs: ['z', 'x', 'y'] },
] as const

export interface FlowCurve {
  id: FlowId
  label: string
  curve: Curve<Vector3>
  from: Vector3
  to: Vector3
  length: number
  /** Names actually resolved, in order — useful when a chain is auto-expanded. */
  waypoints: string[]
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

/**
 * `Base` plus every numbered sibling, ordered by that number.
 *
 * The dot is optional on purpose. Blender names duplicates `PV-Juntas.001`, but
 * GLTFLoader runs every node name through `PropertyBinding.sanitizeNodeName`,
 * which strips the characters reserved for animation paths — `[ ] . : /`. So the
 * Empty that is `PV-Juntas.001` in the file arrives as `PV-Juntas001` in the
 * scene. Matching only the dotted form silently finds nothing, and the chain is
 * skipped altogether while everything still appears to work.
 */
export function expandChain(empties: Map<string, Object3D>, base: string): string[] {
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?(\\d+)$`)
  const suffixed: Array<{ name: string; index: number }> = []

  for (const name of empties.keys()) {
    const match = pattern.exec(name)
    if (match) suffixed.push({ name, index: Number(match[1]) })
  }

  suffixed.sort((a, b) => a.index - b.index)
  return [base, ...suffixed.map((entry) => entry.name)]
}

export function resolveRouteNames(empties: Map<string, Object3D>, through: readonly string[]): string[] {
  const names: string[] = []

  for (const entry of through) {
    if (entry.includes('|')) {
      const found = entry.split('|').find((name) => empties.has(name))
      if (found) names.push(found)
      continue
    }
    if (entry.endsWith('*')) {
      names.push(...expandChain(empties, entry.slice(0, -1)).filter((name) => empties.has(name)))
      continue
    }
    if (entry.endsWith('?')) {
      const name = entry.slice(0, -1)
      if (empties.has(name)) names.push(name)
      continue
    }
    names.push(entry)
  }

  // Consecutive duplicates would create zero-length segments.
  return names.filter((name, i) => name !== names[i - 1])
}

/** Axis-aligned corner points between two anchors, with zero-length moves dropped. */
function bridge(from: Vector3, to: Vector3, legs: readonly Axis[], liftAbove?: number): Vector3[] {
  const points: Vector3[] = []
  const cursor = from.clone()

  const push = (): void => {
    const last = points[points.length - 1] ?? from
    if (last.distanceToSquared(cursor) > 1e-8) points.push(cursor.clone())
  }

  if (liftAbove !== undefined) {
    cursor.y = Math.max(from.y, to.y) + liftAbove
    push()
  }
  for (const axis of legs) {
    cursor[axis] = to[axis]
    push()
  }
  cursor.copy(to)
  push()
  return points
}

/**
 * Turns a corner polyline into straight segments joined by rounded fillets. The
 * radius shrinks where two corners crowd each other, so a short leg between two
 * turns still produces a clean shape instead of overlapping arcs.
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
    const resolved = resolveRouteNames(empties, spec.through)

    const names: string[] = []
    const anchors: Vector3[] = []
    for (const name of resolved) {
      const node = empties.get(name)
      if (!node) throw new MissingWaypointError(spec.id, name)
      const position = node.getWorldPosition(new Vector3())

      // A waypoint sitting on one the route already passed is a Blender duplicate
      // that never got moved. Following it sends the flow back the way it came, so
      // it is skipped rather than drawn as a visible mistake.
      const repeat = anchors.findIndex((seen) => seen.distanceToSquared(position) < 1e-8)
      if (repeat !== -1) {
        console.warn(`Ruta "${spec.id}": omito "${name}", coincide en posición con "${names[repeat]}"`)
        continue
      }

      names.push(name)
      anchors.push(position)
    }

    const corners: Vector3[] = [anchors[0]!]
    for (let i = 1; i < anchors.length; i += 1) {
      // The lift only applies to the first hop; later hops follow the authored chain.
      const lift = i === 1 ? spec.liftAbove : undefined
      corners.push(...bridge(anchors[i - 1]!, anchors[i]!, spec.legs, lift))
    }

    const curve = buildRoundedPath(corners, spec.cornerRadius ?? cornerRadius)

    return {
      id: spec.id,
      label: spec.label,
      curve,
      from: anchors[0]!,
      to: anchors[anchors.length - 1]!,
      length: curve.getLength(),
      waypoints: names,
    }
  })
}
