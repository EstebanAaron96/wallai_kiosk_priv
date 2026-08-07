import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'

/**
 * Grounding pass for a model that sits over a dark backdrop with no floor.
 *
 * A conventional dark contact shadow is invisible here — it lands on a navy
 * gradient of almost the same value. Instead the model rests on a soft pool of
 * light, with a small darker core directly underneath to read as contact.
 */
function radialTexture(stops: Array<[number, string]>): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto 2D para el suelo')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function plane(texture: CanvasTexture, blending: typeof NormalBlending | typeof AdditiveBlending): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending,
      toneMapped: false,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

export interface GroundOptions {
  /** `glow` lifts the base out of a dark backdrop; `shadow` grounds it on a pale one. */
  mode: 'glow' | 'shadow'
}

export function createGroundShadow(target: Object3D, options: GroundOptions = { mode: 'glow' }): Object3D {
  const box = new Box3().setFromObject(target)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const floor = box.min.y

  const group = new Object3D()
  group.name = 'GroundPool'
  const pale = options.mode === 'shadow'

  // On a dark backdrop the model rests on a pool of light; on a pale one that
  // pool is invisible, so the same plane becomes a real soft shadow instead.
  const pool = plane(
    radialTexture(
      pale
        ? [
            [0, 'rgba(52,72,112,0.30)'],
            [0.34, 'rgba(80,102,145,0.16)'],
            [0.66, 'rgba(120,140,175,0.05)'],
            [1, 'rgba(140,160,190,0)'],
          ]
        : [
            [0, 'rgba(120,165,255,0.34)'],
            [0.32, 'rgba(78,120,220,0.17)'],
            [0.62, 'rgba(50,85,175,0.06)'],
            [1, 'rgba(40,70,150,0)'],
          ],
    ),
    pale ? NormalBlending : AdditiveBlending,
  )
  pool.scale.set(size.x * 2.2, size.z * 3.0, 1)
  pool.position.set(center.x, floor - size.y * 0.012, center.z)
  pool.renderOrder = -3
  group.add(pool)

  // Tight core right under the footprint, reading as contact with the ground.
  const contact = plane(
    radialTexture(
      pale
        ? [
            [0, 'rgba(40,58,92,0.42)'],
            [0.5, 'rgba(60,80,118,0.18)'],
            [1, 'rgba(80,100,140,0)'],
          ]
        : [
            [0, 'rgba(4,10,30,0.55)'],
            [0.5, 'rgba(4,10,30,0.22)'],
            [1, 'rgba(4,10,30,0)'],
          ],
    ),
    NormalBlending,
  )
  contact.scale.set(size.x * 0.85, size.z * 1.15, 1)
  contact.position.set(center.x, floor - size.y * 0.008, center.z)
  contact.renderOrder = -2
  group.add(contact)

  return group
}
