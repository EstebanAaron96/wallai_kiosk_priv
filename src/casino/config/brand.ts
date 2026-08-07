/**
 * Kível brand tokens, from «Kível - Manual de marca» v1 / 2026.07.29.
 *
 * Note on the name: the manual is explicit that the «i» always carries a tilde —
 * «Kível», with no exceptions, in any copy, legal document or digital platform.
 */

/** Section 2.7 — paleta principal y escala de grises. */
export const brandColors = {
  carbon: '#1A1A1A',
  white: '#FFFFFF',
  greyLight: '#F2F2F2',
  greyMid: '#D9D9D9',
  greyDark: '#7A7A7A',
} as const

/**
 * Section 2.7 — Espectro Kível. Five stops at the exact positions the manual
 * specifies. Section 2.9 restricts its use to a thin structural delimiter or a
 * subtle photographic overlay: it must never saturate a composition, so it is
 * deliberately NOT used for the energy flows or the charts, whose colours are
 * chosen for contrast and colour-blind separation instead.
 */
export const kivelSpectrum = [
  { position: 32, name: 'Azul oscuro', hex: '#001B90' },
  { position: 50, name: 'Turquesa', hex: '#63BFCB' },
  { position: 62, name: 'Arena', hex: '#EED6A8' },
  { position: 70, name: 'Oro', hex: '#FFC937' },
  { position: 80, name: 'Rojo', hex: '#DF2100' },
] as const

/** CSS gradient for the delimiter line, black at both ends as in the manual. */
export const spectrumGradient = `linear-gradient(90deg, ${brandColors.carbon} 0%, ${kivelSpectrum
  .map((stop) => `${stop.hex} ${stop.position}%`)
  .join(', ')}, ${brandColors.carbon} 100%)`

/**
 * Section 2.4 — reducciones mínimas, entorno digital. The horizontal imagotipo
 * must never render below 88 px wide; the logotipo alone below 48 px.
 */
export const minimumLogoWidthPx = {
  imagotipoHorizontal: 88,
  logotipo: 48,
  isotipo: 24,
} as const
