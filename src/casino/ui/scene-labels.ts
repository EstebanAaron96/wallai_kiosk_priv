import { Object3D, Vector3 } from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { palette } from '../config/theme.ts'
import { formatPower } from './format.ts'
import { totalGeneration, type EnergySnapshot } from '../data/types.ts'

/**
 * Floating readouts anchored to the scene, in the same shape as the 2D dashboard:
 * a colour dot, a caption, a large number and a small unit.
 *
 * Rendered through CSS2DRenderer rather than drawn into the canvas so the digits
 * stay vector-crisp on a 4K panel and inherit the page's typography.
 */

interface LabelSpec {
  id: 'grid' | 'generation' | 'consumption'
  caption: string
  anchor: string
  color: string
  /** Offset from the anchor, as a fraction of the scene size. */
  lift: number
}

const SPECS: readonly LabelSpec[] = [
  { id: 'grid', caption: 'Red', anchor: 'Grid', color: palette.grid, lift: 0.10 },
  { id: 'generation', caption: 'Generación', anchor: 'PV-Juntas', color: palette.solar, lift: 0.14 },
  { id: 'consumption', caption: 'Consumo', anchor: 'Load', color: palette.consumption, lift: 0.06 },
] as const

export interface SceneLabels {
  object: Object3D
  update(snapshot: EnergySnapshot): void
}

export function createSceneLabels(empties: Map<string, Object3D>, sceneSize: number): SceneLabels {
  const object = new Object3D()
  object.name = 'SceneLabels'

  const values = new Map<LabelSpec['id'], HTMLElement>()
  const states = new Map<LabelSpec['id'], HTMLElement>()

  for (const spec of SPECS) {
    const anchor = empties.get(spec.anchor)
    if (!anchor) continue

    const element = document.createElement('div')
    element.className = 'kpi'
    element.innerHTML = `
      <span class="kpi__caption"><span class="kpi__dot" style="background:${spec.color}"></span>${spec.caption}</span>
      <span class="kpi__reading">
        <span class="kpi__value">—</span><span class="kpi__unit">kW</span>
      </span>
      <span class="kpi__state"></span>`

    values.set(spec.id, element.querySelector<HTMLElement>('.kpi__value')!)
    states.set(spec.id, element.querySelector<HTMLElement>('.kpi__state')!)

    const label = new CSS2DObject(element)
    label.position.copy(anchor.getWorldPosition(new Vector3()))
    label.position.y += sceneSize * spec.lift
    object.add(label)
  }

  return {
    object,

    update(snapshot) {
      const exporting = snapshot.red_kW < 0

      values.get('grid')!.textContent = formatPower(Math.abs(snapshot.red_kW))
      values.get('generation')!.textContent = formatPower(totalGeneration(snapshot))
      values.get('consumption')!.textContent = formatPower(snapshot.consumo_kW)

      // The grid figure is unsigned, so the direction has to be said in words.
      const gridState = states.get('grid')!
      gridState.textContent = exporting ? 'Vertiendo a red' : 'Importando'
      gridState.dataset['direction'] = exporting ? 'export' : 'import'
    },
  }
}
