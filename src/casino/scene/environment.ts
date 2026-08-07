import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  PMREMGenerator,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three'

/**
 * Procedural equirectangular sky, prefiltered through PMREM into an environment
 * map. Generated in-page rather than loaded as an .hdr so the kiosk needs no
 * extra asset and works with no network at all.
 */
export interface EnvironmentOptions {
  /** Direction the bright spot sits in — keep in sync with the key light. */
  sunDirection: Vector3
  /** Overall brightness multiplier of the sky dome. */
  intensity?: number
}

const WIDTH = 1024
const HEIGHT = 512

/**
 * three.js equirect convention (see `equirectUv` in the shader chunks):
 *   u = atan2(z, x) / 2π + 0.5      v = asin(y) / π + 0.5
 * With the default `flipY`, v = 1 is the top row of the canvas.
 */
function directionToPixel(direction: Vector3): { x: number; y: number } {
  const d = direction.clone().normalize()
  const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5
  const v = Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI + 0.5
  return { x: u * WIDTH, y: (1 - v) * HEIGHT }
}

function drawSky(sunDirection: Vector3, intensity: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto 2D para el entorno')

  // Zenith → horizon → ground. Cool white above, warm haze at the horizon and a
  // dark navy floor so the underside of the building does not go flat black.
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  sky.addColorStop(0.0, '#dfe9fb')
  sky.addColorStop(0.34, '#c3d5f0')
  sky.addColorStop(0.5, '#e8e2d6')
  sky.addColorStop(0.56, '#9aa6bd')
  sky.addColorStop(1.0, '#26324c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Broad key highlight — gives PBR materials a direction to catch.
  const sun = directionToPixel(sunDirection)
  const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, HEIGHT * 0.55)
  glow.addColorStop(0, 'rgba(255,252,240,0.95)')
  glow.addColorStop(0.25, 'rgba(255,246,222,0.42)')
  glow.addColorStop(1, 'rgba(255,246,222,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // The sky wraps at u = 0/1; repeat the glow across the seam when it is close.
  if (sun.x < HEIGHT * 0.55 || sun.x > WIDTH - HEIGHT * 0.55) {
    const wrappedX = sun.x < WIDTH / 2 ? sun.x + WIDTH : sun.x - WIDTH
    const wrapped = ctx.createRadialGradient(wrappedX, sun.y, 0, wrappedX, sun.y, HEIGHT * 0.55)
    wrapped.addColorStop(0, 'rgba(255,252,240,0.95)')
    wrapped.addColorStop(0.25, 'rgba(255,246,222,0.42)')
    wrapped.addColorStop(1, 'rgba(255,246,222,0)')
    ctx.fillStyle = wrapped
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  if (intensity !== 1) {
    ctx.globalCompositeOperation = intensity > 1 ? 'lighter' : 'multiply'
    ctx.globalAlpha = intensity > 1 ? Math.min(intensity - 1, 1) : 1
    ctx.fillStyle = intensity > 1 ? '#ffffff' : `rgba(255,255,255,${intensity})`
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  return canvas
}

export interface GeneratedEnvironment {
  texture: Texture
  dispose(): void
}

export function createEnvironment(
  renderer: WebGLRenderer,
  { sunDirection, intensity = 1 }: EnvironmentOptions,
): GeneratedEnvironment {
  const canvas = drawSky(sunDirection, intensity)

  const source = new CanvasTexture(canvas)
  source.mapping = EquirectangularReflectionMapping
  // PMREM works in linear space; the canvas already holds the values we want.
  source.colorSpace = LinearSRGBColorSpace
  source.needsUpdate = true

  const pmrem = new PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const target = pmrem.fromEquirectangular(source)

  source.dispose()
  pmrem.dispose()

  return {
    texture: target.texture,
    dispose() {
      target.dispose()
    },
  }
}

/** Applies the generated environment as the scene's IBL source. */
export function applyEnvironment(scene: Scene, environment: GeneratedEnvironment): void {
  scene.environment = environment.texture
}
