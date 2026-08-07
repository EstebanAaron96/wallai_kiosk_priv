/**
 * Design tokens taken from the existing 2D dashboard.
 * Kept in TS (not only CSS) because the 3D layer needs the same values
 * for materials, shader uniforms and canvas-drawn elements.
 */

export const palette = {
  /** Deep navy of the header banners and card titles. */
  navy: '#1A1A1A',
  navyDeep: '#1A1A1A',
  navySoft: '#3A3A3A',

  /** Yellow underline accent ("Jorge"). */
  accent: '#FFC937',

  /** Solar / photovoltaic flow. */
  solar: '#1B6FE8',
  solarBright: '#4E9BFF',

  /** Grid (red eléctrica) flow. */
  grid: '#F5A623',
  gridBright: '#FFC65C',

  /** Consumption / import figures. */
  consumption: '#DF2100',

  /** Production / savings figures. */
  production: '#22C55E',

  white: '#FFFFFF',
  surface: '#FFFFFF',
  pageBg: '#F2F2F2',
  textMuted: '#7A7A7A',
} as const

export const flowColors = {
  /** PV1/PV2 → junction → load, and load → grid when exporting. */
  solar: palette.solar,
  /** Grid → load import. */
  grid: palette.grid,
} as const
