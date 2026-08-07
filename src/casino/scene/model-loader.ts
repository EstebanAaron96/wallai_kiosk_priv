import { Box3, Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader, DRACO_GLTF_CONFIG } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface LoadProgress {
  loaded: number
  total: number
  /** 0..1, or null while the server sends no Content-Length. */
  ratio: number | null
}

export interface LoadedModel {
  gltf: GLTF
  root: Object3D
  /** Empties keyed by their Blender name, e.g. `PV1`, `Grid`. */
  empties: Map<string, Object3D>
  bounds: Box3
  center: Vector3
  size: Vector3
}

/**
 * Blender Empties come through glTF as bare nodes: no geometry, no camera,
 * no light. Anything the GLTFLoader instantiates as a plain `Object3D` and
 * that carries no renderable of its own is treated as a waypoint marker.
 */
function isEmpty(object: Object3D): boolean {
  return object.type === 'Object3D' && !object.userData['isRoot']
}

export function collectEmpties(root: Object3D): Map<string, Object3D> {
  const empties = new Map<string, Object3D>()
  root.traverse((object) => {
    if (isEmpty(object) && object.name) empties.set(object.name, object)
  })
  return empties
}

export async function loadModel(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<LoadedModel> {
  const dracoLoader = new DRACOLoader()
  // The glTF-tuned decoder shipped inside three/examples, resolved by the bundler
  // from the package itself. Copying the decoders into public/ also works, but the
  // copy silently drifts out of step the next time three is upgraded.
  dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG)

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  try {
    const gltf = await loader.loadAsync(url, (event) => {
      onProgress?.({
        loaded: event.loaded,
        total: event.total,
        ratio: event.lengthComputable && event.total > 0 ? event.loaded / event.total : null,
      })
    })

    const root = gltf.scene
    root.userData['isRoot'] = true

    const bounds = new Box3().setFromObject(root)
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())

    return { gltf, root, empties: collectEmpties(root), bounds, center, size }
  } finally {
    // The decoder module stays cached by DRACOLoader; only the worker pool is freed.
    dracoLoader.dispose()
  }
}
