import { formatEnergy, formatPercent } from './format.ts'
import type { AccumulatedEnergy } from '../data/types.ts'
import { solarShare } from '../data/types.ts'

/**
 * Two-segment part-to-whole ring, hand-built in SVG.
 *
 * The ring shows the split at a glance; the real reading is the hero percentage
 * in the middle and the exact kWh in the breakdown below. Both segments carry a
 * direct label, so identity never depends on colour alone — which also covers the
 * kiosk case where nothing is hoverable.
 */

/**
 * Chart colours arrive from the active skin. Each skin's pair is validated
 * against *its own* card surface — a palette that clears contrast on white does
 * not necessarily clear it on navy, so they are genuinely different steps rather
 * than the same hex reused.
 */
export interface DonutColors {
  solar: string
  grid: string
  track: string
}

const RADIUS = 42
const STROKE = 11
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Surface-coloured gap between the two segments, in path units. */
const GAP = 2.4

export interface DonutOptions {
  title: string
  /** Small caption under the title, e.g. the month name. */
  caption?: string
  colors: DonutColors
}

export interface Donut {
  element: HTMLElement
  update(accumulated: AccumulatedEnergy, caption?: string): void
  setColors(colors: DonutColors): void
}

function svg(tag: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
  return node
}

export function createDonut({ title, caption, colors }: DonutOptions): Donut {
  const element = document.createElement('section')
  element.className = 'donut-card'

  element.innerHTML = `
    <header class="donut-card__header">
      <h3 class="donut-card__title">${title}</h3>
      <p class="donut-card__caption"></p>
    </header>
    <div class="donut-card__chart"></div>
    <dl class="donut-legend">
      <div class="donut-legend__row" data-series="solar">
        <dt><span class="donut-legend__dot" style="background:${colors.solar}"></span>Fotovoltaica</dt>
        <dd><span class="donut-legend__value">—</span><span class="donut-legend__unit">kWh</span></dd>
      </div>
      <div class="donut-legend__row" data-series="grid">
        <dt><span class="donut-legend__dot" style="background:${colors.grid}"></span>Red eléctrica</dt>
        <dd><span class="donut-legend__value">—</span><span class="donut-legend__unit">kWh</span></dd>
      </div>
    </dl>`

  const chart = element.querySelector<HTMLElement>('.donut-card__chart')!
  const captionNode = element.querySelector<HTMLElement>('.donut-card__caption')!

  const root = svg('svg', { viewBox: '0 0 100 100', class: 'donut', role: 'img' })
  const label = svg('title', {})
  root.append(label)

  // Track sits one step off the surface, recessive.
  root.append(
    svg('circle', {
      cx: '50', cy: '50', r: String(RADIUS),
      fill: 'none', stroke: colors.track, 'stroke-width': String(STROKE),
    }),
  )

  const solarArc = svg('circle', {
    cx: '50', cy: '50', r: String(RADIUS),
    fill: 'none', stroke: colors.solar, 'stroke-width': String(STROKE),
    'stroke-linecap': 'butt', transform: 'rotate(-90 50 50)',
    'stroke-dasharray': `0 ${CIRCUMFERENCE}`,
  })
  const gridArc = svg('circle', {
    cx: '50', cy: '50', r: String(RADIUS),
    fill: 'none', stroke: colors.grid, 'stroke-width': String(STROKE),
    'stroke-linecap': 'butt', transform: 'rotate(-90 50 50)',
    'stroke-dasharray': `0 ${CIRCUMFERENCE}`,
  })
  root.append(gridArc, solarArc)

  // Hero percentage. Proportional figures — tabular-nums would make a big number
  // look loose, and this one is not in a column.
  const value = svg('text', {
    x: '50', y: '47', class: 'donut__value', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
  })
  const unit = svg('text', {
    x: '50', y: '62', class: 'donut__unit', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
  })
  unit.textContent = 'solar'
  root.append(value, unit)
  chart.append(root)

  const solarValue = element.querySelector<HTMLElement>('[data-series="solar"] .donut-legend__value')!
  const gridValue = element.querySelector<HTMLElement>('[data-series="grid"] .donut-legend__value')!

  let displayedShare = 0
  let animation: number | null = null

  /** Eases the hero number and the arcs together so they never disagree mid-flight. */
  function animateTo(share: number): void {
    if (animation !== null) cancelAnimationFrame(animation)
    const from = displayedShare
    const delta = share - from
    if (Math.abs(delta) < 0.0001) return applyShare(share)

    const duration = 700
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic
      applyShare(from + delta * (1 - (1 - t) ** 3))
      if (t < 1) animation = requestAnimationFrame(step)
      else animation = null
    }
    animation = requestAnimationFrame(step)
  }

  function applyShare(share: number): void {
    displayedShare = share
    const solarLength = share * CIRCUMFERENCE
    const gridLength = CIRCUMFERENCE - solarLength

    // Both segments give up half the gap at each end, so the surface shows
    // through between them instead of a stroke being drawn around each.
    const solarDrawn = Math.max(0, solarLength - GAP)
    const gridDrawn = Math.max(0, gridLength - GAP)

    solarArc.setAttribute('stroke-dasharray', `${solarDrawn} ${CIRCUMFERENCE - solarDrawn}`)
    solarArc.setAttribute('stroke-dashoffset', String(-GAP / 2))

    gridArc.setAttribute('stroke-dasharray', `${gridDrawn} ${CIRCUMFERENCE - gridDrawn}`)
    gridArc.setAttribute('stroke-dashoffset', String(-(solarLength + GAP / 2)))

    value.textContent = `${formatPercent(share)} %`
  }

  applyShare(0)

  const trackCircle = root.querySelector('circle')!
  const solarDot = element.querySelector<HTMLElement>('[data-series="solar"] .donut-legend__dot')!
  const gridDot = element.querySelector<HTMLElement>('[data-series="grid"] .donut-legend__dot')!

  return {
    element,

    setColors(next) {
      trackCircle.setAttribute('stroke', next.track)
      solarArc.setAttribute('stroke', next.solar)
      gridArc.setAttribute('stroke', next.grid)
      solarDot.style.background = next.solar
      gridDot.style.background = next.grid
    },

    update(accumulated, nextCaption) {
      const share = solarShare(accumulated)
      animateTo(share)

      solarValue.textContent = formatEnergy(accumulated.fotovoltaica_kWh)
      gridValue.textContent = formatEnergy(accumulated.red_kWh)

      const text = nextCaption ?? caption ?? ''
      captionNode.textContent = text
      captionNode.hidden = text === ''

      label.textContent =
        `${title}: ${formatPercent(share)} % solar. ` +
        `Fotovoltaica ${formatEnergy(accumulated.fotovoltaica_kWh)} kWh, ` +
        `red eléctrica ${formatEnergy(accumulated.red_kWh)} kWh.`
    },
  }
}
