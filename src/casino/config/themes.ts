/**
 * The two kiosk skins.
 *
 * They are not a light/dark inversion of one stylesheet: the 3D layer has to
 * change with them. Additive blending is invisible over a pale backdrop — adding
 * light to near-white gives white — so the energy flows switch to alpha blending
 * on the light skin, and the "shadow" under the model flips from a glow pool to
 * an actual dark contact shadow.
 */
export type ThemeName = 'dark' | 'light'

export interface Theme {
  name: ThemeName
  label: string

  /** Backdrop gradient drawn inside the scene, centre → edge. */
  backdrop: { inner: string; mid: string; outer: string }

  /** How the flow tubes composite over that backdrop. */
  flowBlending: 'additive' | 'alpha'

  /** Flow colours; the light skin needs deeper steps to hold up on pale ground. */
  flow: { solar: string; grid: string }

  /**
   * Chart palette for the donut cards, validated against that skin's card
   * surface — band, chroma, CVD separation and 3:1 contrast.
   */
  chart: { solar: string; grid: string; track: string }

  /** Ground treatment under the model. */
  ground: { mode: 'glow' | 'shadow'; color: string }

  /** Scene lighting trim, so the model does not look flat on a pale backdrop. */
  exposure: number
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    label: 'Oscuro',
    backdrop: { inner: '#24407e', mid: '#16295a', outer: '#0d1b3f' },
    flowBlending: 'additive',
    flow: { solar: '#1B6FE8', grid: '#F5A623' },
    // Validated on a white card: all checks pass.
    chart: { solar: '#1B6FE8', grid: '#C97F12', track: '#E7ECF4' },
    ground: { mode: 'glow', color: '#5A82DC' },
    exposure: 1.05,
  },

  light: {
    name: 'light',
    label: 'Claro',
    // Brand greys (2.7): white centre falling to Gris claro at the edge, which is
    // also the page colour, so canvas and panel meet with no seam.
    backdrop: { inner: '#ffffff', mid: '#f8f8f8', outer: '#f2f2f2' },
    // Alpha, not additive: over a pale backdrop additive washes out to nothing.
    flowBlending: 'alpha',
    // Deeper steps so the strands stay saturated against the pale ground.
    flow: { solar: '#1552C4', grid: '#C97F12' },
    // Validated on the Negro carbón card (#1A1A1A): all five checks pass.
    chart: { solar: '#268BFC', grid: '#BC781A', track: '#3A3A3A' },
    ground: { mode: 'shadow', color: '#9A9A9A' },
    exposure: 1.12,
  },
}
