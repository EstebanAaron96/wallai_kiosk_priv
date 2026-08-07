import { Box3, BufferGeometry, Mesh, Object3D, Vector3 } from 'three'
import type { LoadedModel } from './model-loader.ts'

export interface NodeReport {
  name: string
  type: string
  depth: number
  /** World-space position, model matrices already applied. */
  world: Vector3
  vertices: number
  isEmpty: boolean
}

const scratch = new Vector3()

function vertexCount(object: Object3D): number {
  if (!(object instanceof Mesh)) return 0
  const geometry: BufferGeometry = object.geometry
  return geometry.getAttribute('position')?.count ?? 0
}

/**
 * Walks the loaded scene once and returns a flat, depth-annotated report.
 * `updateWorldMatrix` runs first so `getWorldPosition` is trustworthy for
 * the Empties we are about to turn into flow waypoints.
 */
export function inspectHierarchy(root: Object3D): NodeReport[] {
  root.updateWorldMatrix(true, true)

  const report: NodeReport[] = []
  const walk = (object: Object3D, depth: number): void => {
    if (depth > 0 || object !== root) {
      report.push({
        name: object.name || '(sin nombre)',
        type: object.type,
        depth,
        world: object.getWorldPosition(new Vector3()).clone(),
        vertices: vertexCount(object),
        isEmpty: object.type === 'Object3D' && object !== root,
      })
    }
    for (const child of object.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return report
}

const fmt = (n: number): string =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** Dumps the full hierarchy to the console as a readable tree + a table. */
export function logHierarchy(model: LoadedModel): NodeReport[] {
  const report = inspectHierarchy(model.root)
  const empties = report.filter((node) => node.isEmpty)
  const meshes = report.filter((node) => node.vertices > 0)
  const totalVertices = meshes.reduce((sum, node) => sum + node.vertices, 0)

  console.groupCollapsed(
    `%c🌳 Jerarquía del GLB%c  ${report.length} nodos · ${meshes.length} mallas · ${empties.length} empties`,
    'font-weight:700;color:#1B6FE8', 'color:#6B7B99;font-weight:400',
  )
  for (const node of report) {
    const indent = '│  '.repeat(Math.max(0, node.depth - 1))
    const badge = node.isEmpty ? '📍 EMPTY' : node.vertices > 0 ? `▦ ${node.vertices.toLocaleString('es-ES')} v` : node.type
    const p = node.world
    console.log(
      `%c${indent}├─ %c${node.name}%c  ·  ${badge}  ·  (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)})`,
      'color:#94A3B8', node.isEmpty ? 'color:#F5A623;font-weight:700' : 'color:#0F172A;font-weight:600', 'color:#6B7B99',
    )
  }
  console.groupEnd()

  console.group('%c📍 Empties encontrados (waypoints de flujo)', 'font-weight:700;color:#F5A623')
  console.table(
    empties.map((node) => ({
      Nombre: node.name,
      X: Number(node.world.x.toFixed(4)),
      Y: Number(node.world.y.toFixed(4)),
      Z: Number(node.world.z.toFixed(4)),
    })),
  )
  console.groupEnd()

  const size = model.size
  console.group('%c📐 Métricas de la escena', 'font-weight:700;color:#22C55E')
  console.log(`Vértices totales : ${totalVertices.toLocaleString('es-ES')}`)
  console.log(`Bounding box     : ${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}`)
  console.log(`Centro           : (${fmt(model.center.x)}, ${fmt(model.center.y)}, ${fmt(model.center.z)})`)
  console.groupEnd()

  return report
}

/** Per-object bounding box, used by the inspector overlay to describe volumes. */
export function boundsOf(object: Object3D): { size: Vector3; center: Vector3 } {
  const box = new Box3().setFromObject(object)
  return { size: box.getSize(new Vector3()), center: box.getCenter(scratch.clone()) }
}
