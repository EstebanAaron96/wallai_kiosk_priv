import { CanvasTexture, SRGBColorSpace, Texture } from 'three'

/**
 * Scene backdrop, drawn inside WebGL rather than as a CSS background.
 *
 * The energy flows blend additively, and additive blending needs something to
 * add onto: over a transparent canvas the destination is (0,0,0,0), so a dim
 * glow reads as near-black instead of a soft lift over the navy, and its alpha
 * contribution punches through whatever CSS sits behind. Rendering the gradient
 * into the scene keeps every pixel opaque and makes the glows composite the same
 * way over the backdrop as they do over the building.
 */
export function createBackdropTexture(colors: { inner: string; mid: string; outer: string }): Texture {
  const width = 512
  const height = 288
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el contexto 2D para el fondo')

  ctx.fillStyle = colors.outer
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(
    width * 0.5, height * 0.42, 0,
    width * 0.5, height * 0.42, width * 0.62,
  )
  glow.addColorStop(0, colors.inner)
  glow.addColorStop(0.45, colors.mid)
  glow.addColorStop(1, colors.outer)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
