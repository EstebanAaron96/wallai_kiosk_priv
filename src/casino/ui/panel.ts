import { createDonut, type Donut, type DonutColors } from './donut.ts'
import type { EnergySnapshot } from '../data/types.ts'

/**
 * Side panel: the two accumulated-energy rings. Current month on top, year below —
 * the recent figure is the one that changes, so it leads.
 */
export interface Panel {
  element: HTMLElement
  update(snapshot: EnergySnapshot): void
  setColors(colors: DonutColors): void
  /**
   * Year and month come from separate, throttled API calls ~20s apart (see
   * useKioskAccumulated), so each ring shows its own "Cargando…" state until its
   * own period has actually loaded, rather than both waiting on the slower one.
   */
  setLoading(ready: { year: boolean; month: boolean }): void
}

export function createPanel(colors: DonutColors): Panel {
  const element = document.createElement('aside')
  element.className = 'panel'

  const heading = document.createElement('div')
  heading.className = 'panel__heading'
  heading.innerHTML = `
    <h2 class="panel__title">Energía acumulada</h2>
    <span class="live"><span class="live__dot"></span>En directo</span>`
  element.append(heading)

  const year: Donut = createDonut({ title: 'Este año', caption: String(new Date().getFullYear()), colors })
  const month: Donut = createDonut({ title: 'Este mes', colors })

  element.append(month.element, year.element)

  year.setLoading(true)
  month.setLoading(true)

  return {
    element,

    update(snapshot) {
      year.update(snapshot.acumulado_anual)
      month.update(snapshot.acumulado_mes, snapshot.acumulado_mes.mes)
    },

    setColors(next) {
      year.setColors(next)
      month.setColors(next)
    },

    setLoading(ready) {
      year.setLoading(!ready.year)
      month.setLoading(!ready.month)
    },
  }
}
