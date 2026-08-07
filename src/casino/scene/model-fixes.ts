import { Mesh, MeshPhysicalMaterial, Object3D, type Material } from 'three'

/**
 * Corrections for issues baked into the Blender export. Applied at runtime so a
 * re-export from Blender cannot silently lose them; each fix reports what it
 * touched so regressions in a future export are visible in the console.
 */
export interface ModelFixReport {
  removedDuplicates: string[]
  trianglesSaved: number
  transmissionCleared: string[]
}

interface MeshFingerprint {
  key: string
  triangles: number
}

/**
 * Identity of a mesh as it appears on screen: geometry size, world placement and
 * a sample of actual vertex positions. Two meshes sharing all of it draw exactly
 * the same pixels, so the second one is dead weight.
 */
function fingerprint(mesh: Mesh): MeshFingerprint {
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const vertices = position?.count ?? 0
  const indices = geometry.index?.count ?? 0
  const triangles = indices > 0 ? indices / 3 : vertices / 3

  const samples: number[] = []
  if (position && vertices > 0) {
    for (const ratio of [0, 0.25, 0.5, 0.75, 0.99]) {
      const i = Math.min(vertices - 1, Math.floor(vertices * ratio))
      samples.push(position.getX(i), position.getY(i), position.getZ(i))
    }
  }

  const matrix = mesh.matrixWorld.elements.map((n) => n.toFixed(5)).join(',')
  const key = `${vertices}|${indices}|${matrix}|${samples.map((n) => n.toFixed(4)).join(',')}`
  return { key, triangles }
}

/**
 * Removes meshes that render identically to one already kept.
 * The export contains the main building twice, stacked on itself.
 */
export function removeDuplicateMeshes(root: Object3D): { removed: string[]; triangles: number } {
  root.updateWorldMatrix(true, true)

  const seen = new Map<string, string>()
  const duplicates: Mesh[] = []
  let triangles = 0

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const { key, triangles: count } = fingerprint(object)
    const original = seen.get(key)
    if (original === undefined) {
      seen.set(key, object.name || '(sin nombre)')
      return
    }
    duplicates.push(object)
    triangles += count
  })

  const removed = duplicates.map((mesh) => mesh.name || '(sin nombre)')
  for (const mesh of duplicates) {
    mesh.removeFromParent()
    mesh.geometry.dispose()
  }
  return { removed, triangles }
}

/**
 * Solar panels exported with `transmission: 1` (clear glass). Physically wrong —
 * a PV panel absorbs light — and it forces three.js to re-render the whole opaque
 * scene into the transmission buffer, doubling the per-frame triangle count.
 */
export function clearFalseTransmission(root: Object3D): string[] {
  const cleared: string[] = []
  const visited = new Set<Material>()

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]

    for (const material of materials) {
      if (!(material instanceof MeshPhysicalMaterial) || visited.has(material)) continue
      visited.add(material)
      if (material.transmission <= 0) continue

      material.transmission = 0
      material.transparent = false
      material.opacity = 1
      // Dark, slightly glossy silicon rather than clear glass.
      material.roughness = Math.min(material.roughness || 0.35, 0.35)
      material.metalness = Math.max(material.metalness, 0.1)
      material.needsUpdate = true
      cleared.push(material.name || '(sin nombre)')
    }
  })

  return cleared
}

export function applyModelFixes(root: Object3D): ModelFixReport {
  const { removed, triangles } = removeDuplicateMeshes(root)
  const transmissionCleared = clearFalseTransmission(root)

  console.group('%c🔧 Correcciones aplicadas al modelo', 'font-weight:700;color:#22C55E')
  console.log(
    `Mallas duplicadas eliminadas: ${removed.length}` +
      (removed.length > 0 ? ` → ${removed.join(', ')} (${triangles.toLocaleString('es-ES')} triángulos)` : ''),
  )
  console.log(`Materiales con transmisión falsa corregidos: ${transmissionCleared.length}`)
  console.groupEnd()

  return { removedDuplicates: removed, trianglesSaved: triangles, transmissionCleared }
}
