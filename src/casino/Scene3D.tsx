import { useEffect, useRef } from 'react'
import type { EnergySnapshot } from './data/types.ts'
import { applySnapshot } from './scene/flow-binding.ts'
import { createEnergyFlows, type EnergyFlowField } from './scene/energy-flow.ts'
import { buildFlowCurves, resolveRouteNames, ROUTES } from './scene/flow-curves.ts'
import { createGroundShadow } from './scene/ground-shadow.ts'
import { logHierarchy, type NodeReport } from './scene/inspect.ts'
import { applyModelFixes } from './scene/model-fixes.ts'
import { loadModel, type LoadedModel } from './scene/model-loader.ts'
import { createEmptyMarkers, createViewer } from './scene/viewer.ts'
import { THEMES, type Theme, type ThemeName } from './config/themes.ts'
import { installKioskResilience } from './kiosk/resilience.ts'
import { createHeader } from './ui/header.ts'
import { createPanel, type Panel } from './ui/panel.ts'
import { createPoweredBy } from './ui/powered-by.ts'
import { createSceneLabels, type SceneLabels } from './ui/scene-labels.ts'
import './casino.css'

const MODEL_URL = '/escena.glb'
const PLANT_TITLE = 'Real Casino de Tenerife'
const PLANT_SUBTITLE = 'Flujo de energia en tiempo real'

/**
 * Where the model sits in the viewport, as fractions of it (+x right, +y up).
 * Tune live with the arrow keys - the console prints the value to paste back here.
 */
const COMPOSITION = { x: 0.03, y: 0.03 }
const ZOOM = 1.0
const HERO_ANGLE = { azimuth: -35, elevation: 10 }
const DEFAULT_THEME: ThemeName = 'light'

const number3 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const integer = new Intl.NumberFormat('es-ES')

export interface Scene3DProps {
  /** null until the first real snapshot arrives; the scene idles at zero until then. */
  snapshot: EnergySnapshot | null
  /**
   * The backend rate-limits the accumulated-stats endpoint to 1 request/20s
   * per kiosk token, so year and month are fetched ~20s apart — month is
   * always the slower of the two. Until a period has loaded at least once, its
   * fields in `snapshot` are zero-filled placeholders, not real readings, so
   * its ring in the panel shows a "Cargando…" overlay instead of being fed
   * misleading zeros. Tracked separately so the year ring (which resolves
   * first) doesn't sit in that state waiting on the slower month call.
   */
  yearReady: boolean
  monthReady: boolean
}

interface SceneHandles {
  flows: EnergyFlowField
  labels: SceneLabels
  panel: Panel
  theme: Theme
}

function renderInspector(model: LoadedModel, report: NodeReport[]): string {
  const empties = report.filter((node) => node.isEmpty)
  const meshes = report.filter((node) => node.vertices > 0)
  const totalVertices = meshes.reduce((sum, node) => sum + node.vertices, 0)
  const found = new Set(empties.map((node) => node.name))

  const routeRows = ROUTES.map((route) => {
    const names = resolveRouteNames(model.empties, route.through)
    const ok = names.every((name) => found.has(name))
    const kind = route.id === 'grid-load' ? 'grid' : 'solar'
    return '<tr class="' + (ok ? '' : 'is-missing') + '">' +
      '<td><span class="dot dot--' + kind + '"></span>' + route.label + '</td>' +
      '<td class="mono">' + names.join(' -&gt; ') + '</td>' +
      '<td class="status">' + (ok ? 'OK' : 'X') + '</td>' +
      '</tr>'
  }).join('')

  const emptyRows = empties.map((node) =>
    '<tr>' +
      '<td class="mono strong">' + node.name + '</td>' +
      '<td class="mono num">' + number3.format(node.world.x) + '</td>' +
      '<td class="mono num">' + number3.format(node.world.y) + '</td>' +
      '<td class="mono num">' + number3.format(node.world.z) + '</td>' +
      '</tr>',
  ).join('')

  return (
    '<section class="block">' +
      '<h2>Empties encontrados <span class="count">' + empties.length + '</span></h2>' +
      '<table class="table">' +
        '<thead><tr><th>Nombre</th><th class="num">X</th><th class="num">Y</th><th class="num">Z</th></tr></thead>' +
        '<tbody>' + emptyRows + '</tbody>' +
      '</table>' +
    '</section>' +
    '<section class="block">' +
      '<h2>Mapeo de flujos propuesto</h2>' +
      '<table class="table table--routes"><tbody>' + routeRows + '</tbody></table>' +
    '</section>' +
    '<section class="block">' +
      '<h2>Metricas</h2>' +
      '<dl class="metrics">' +
        '<div><dt>Nodos</dt><dd>' + integer.format(report.length) + '</dd></div>' +
        '<div><dt>Mallas</dt><dd>' + integer.format(meshes.length) + '</dd></div>' +
        '<div><dt>Vertices</dt><dd>' + integer.format(totalVertices) + '</dd></div>' +
        '<div><dt>Tamano</dt><dd>' +
          number3.format(model.size.x) + ' x ' + number3.format(model.size.y) + ' x ' + number3.format(model.size.z) +
        '</dd></div>' +
      '</dl>' +
    '</section>'
  )
}

/**
 * React shell around the ported Casino 3D scene. Mounts the (framework-free)
 * Three.js scene once, then pushes every new `snapshot` into it - the scene,
 * labels and panel code are untouched from the original design.
 */
export function Scene3D({ snapshot, yearReady, monthReady }: Scene3DProps) {
  const appRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadingScreenRef = useRef<HTMLDivElement>(null)
  const loadingFillRef = useRef<HTMLDivElement>(null)
  const loadingPctRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const inspectorBodyRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  const sceneRef = useRef<SceneHandles | null>(null)
  const snapshotRef = useRef<EnergySnapshot | null>(snapshot)
  snapshotRef.current = snapshot
  const yearReadyRef = useRef(yearReady)
  yearReadyRef.current = yearReady
  const monthReadyRef = useRef(monthReady)
  monthReadyRef.current = monthReady

  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []

    async function bootstrap(): Promise<void> {
      const app = appRef.current!
      const stage = stageRef.current!
      const canvas = canvasRef.current!
      const viewport = viewportRef.current!

      let theme = THEMES[DEFAULT_THEME]
      document.documentElement.dataset['theme'] = theme.name

      const header = createHeader({ title: PLANT_TITLE, subtitle: PLANT_SUBTITLE })
      const panel = createPanel(theme.chart)
      app.prepend(header.element)
      stage.append(panel.element)
      const poweredBy = createPoweredBy()
      viewport.append(poweredBy)
      cleanups.push(() => {
        header.dispose()
        header.element.remove()
        panel.element.remove()
        poweredBy.remove()
      })

      const resilience = installKioskResilience({ canvas })
      cleanups.push(resilience.dispose)

      const viewer = createViewer(canvas, {
        // Idle orbiting is built and reachable, it just is not what the kiosk
        // does when left alone.
        autoRotate: false,
        compositionX: COMPOSITION.x,
        compositionY: COMPOSITION.y,
        heroAzimuthDegrees: HERO_ANGLE.azimuth,
        heroElevationDegrees: HERO_ANGLE.elevation,
        theme: theme.name,
      })
      cleanups.push(viewer.dispose)

      const model = await loadModel(MODEL_URL, ({ ratio, loaded }) => {
        if (cancelled) return
        const pct = ratio === null ? null : Math.round(ratio * 100)
        if (loadingFillRef.current) loadingFillRef.current.style.width = pct === null ? '100%' : pct + '%'
        if (loadingPctRef.current) {
          loadingPctRef.current.textContent =
            pct === null ? (loaded / 1024 / 1024).toFixed(1) + ' MB' : pct.toLocaleString('es-ES') + ' %'
        }
      })
      if (cancelled) return

      applyModelFixes(model.root)
      viewer.scene.add(model.root)

      const grounds: Record<ThemeName, ReturnType<typeof createGroundShadow>> = {
        dark: createGroundShadow(model.root, { mode: THEMES.dark.ground.mode }),
        light: createGroundShadow(model.root, { mode: THEMES.light.ground.mode }),
      }
      viewer.scene.add(grounds.dark, grounds.light)

      const markerRadius = Math.max(model.size.length() * 0.008, 0.001)
      const markers = createEmptyMarkers(model.empties, markerRadius)
      markers.visible = false
      viewer.scene.add(markers)

      const curves = buildFlowCurves(model.empties)
      const flows = createEnergyFlows(curves, { radius: model.size.length() * 0.0034 })
      viewer.scene.add(flows.object)

      const labels = createSceneLabels(model.empties, model.size.length())
      viewer.scene.add(labels.object)

      function applyTheme(name: ThemeName): void {
        theme = viewer.setTheme(name)
        document.documentElement.dataset['theme'] = name
        flows.setBlendMode(theme.flowBlending)
        panel.setColors(theme.chart)
        for (const key of Object.keys(grounds) as ThemeName[]) grounds[key].visible = key === name
        const latest = snapshotRef.current
        if (latest) applySnapshot(flows, latest, theme.flow)
      }

      viewer.onFrame((dt) => flows.update(dt))
      viewer.frame(model.root, ZOOM)
      viewer.start()
      applyTheme(theme.name)

      if (cancelled) return

      sceneRef.current = { flows, labels, panel, theme }
      const initial = snapshotRef.current
      if (initial) {
        applySnapshot(flows, initial, theme.flow)
        labels.update(initial)
        panel.update(initial)
        panel.setLoading({ year: yearReadyRef.current, month: monthReadyRef.current })
      }

      // Frame budget matters on kiosk hardware, but the panel is public: hidden by
      // default, toggled with "s" when someone is checking the machine on site.
      let frames = 0
      let window1s = 0
      cleanups.push(
        viewer.onFrame((dt) => {
          frames += 1
          window1s += dt
          if (window1s >= 1) {
            const info = viewer.renderer.info.render
            if (statsRef.current) {
              statsRef.current.textContent =
                Math.round(frames / window1s) + ' FPS - ' + integer.format(info.triangles) + ' tris - ' + info.calls + ' draw calls'
            }
            frames = 0
            window1s = 0
          }
        }),
      )

      const report = logHierarchy(model)
      if (inspectorBodyRef.current) inspectorBodyRef.current.innerHTML = renderInspector(model, report)

      function logFraming(): void {
        const { x, y } = viewer.getComposition()
        console.log(
          'Encuadre  HERO_ANGLE = { azimuth: ' + hero.azimuth.toFixed(0) + ', elevation: ' + hero.elevation.toFixed(0) + ' }' +
            '   COMPOSITION = { x: ' + x.toFixed(3) + ', y: ' + y.toFixed(3) + ' }   ZOOM = ' + viewer.getZoom().toFixed(2),
        )
      }

      let hero = { ...HERO_ANGLE }

      // On-site controls. The MUPI has no input device, so these only matter when
      // a technician plugs a keyboard in.
      const onKeydown = (event: KeyboardEvent): void => {
        switch (event.key.toLowerCase()) {
          case 'i':
            inspectorRef.current?.toggleAttribute('hidden')
            markers.visible = !inspectorRef.current?.hasAttribute('hidden')
            break
          case 's':
            if (statsRef.current) statsRef.current.hidden = !statsRef.current.hidden
            break
          case 'o':
            viewer.setAutoRotate(!viewer.isAutoRotating())
            break
          case 'arrowleft':
          case 'arrowright':
          case 'arrowup':
          case 'arrowdown': {
            event.preventDefault()
            const step = event.shiftKey ? 0.005 : 0.02
            const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0
            const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0
            viewer.nudgeComposition(dx, dy)
            logFraming()
            break
          }
          case '+':
          case '=':
            viewer.setZoom(Math.max(0.6, viewer.getZoom() - 0.03))
            logFraming()
            break
          case '-':
            viewer.setZoom(Math.min(2.5, viewer.getZoom() + 0.03))
            logFraming()
            break
          case 'r':
            viewer.setComposition(COMPOSITION)
            viewer.setZoom(ZOOM)
            hero = { ...HERO_ANGLE }
            viewer.setHeroAngle(hero.azimuth, hero.elevation)
            logFraming()
            break

          // Hero angle. Dragging with the mouse also turns the model, but the view
          // eases back after half a minute — these change the angle it returns to.
          case 'a':
          case 'd':
            hero.azimuth += event.key.toLowerCase() === 'd' ? (event.shiftKey ? 1 : 5) : (event.shiftKey ? -1 : -5)
            viewer.setHeroAngle(hero.azimuth, hero.elevation)
            logFraming()
            break
          case 'w':
          case 'z':
            hero.elevation = Math.max(2, Math.min(80,
              hero.elevation + (event.key.toLowerCase() === 'w' ? (event.shiftKey ? 1 : 3) : (event.shiftKey ? -1 : -3))))
            viewer.setHeroAngle(hero.azimuth, hero.elevation)
            logFraming()
            break
        }
      }
      window.addEventListener('keydown', onKeydown)
      cleanups.push(() => window.removeEventListener('keydown', onKeydown))

      loadingScreenRef.current?.classList.add('is-hidden')

      Object.assign(window as unknown as Record<string, unknown>, {
        __model: model,
        __viewer: viewer,
        __flows: flows,
        __setTheme: applyTheme,
      })
    }

    bootstrap().catch((error: unknown) => {
      console.error('Fallo al arrancar la escena 3D', error)
      if (loadingPctRef.current) {
        loadingPctRef.current.textContent = error instanceof Error ? error.message : 'Error al cargar el modelo'
      }
      loadingScreenRef.current?.classList.add('has-error')
    })

    return () => {
      cancelled = true
      sceneRef.current = null
      for (const cleanup of cleanups.reverse()) cleanup()
    }
    // Mounted once; snapshot updates flow through the effect below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!sceneRef.current || !snapshot) return
    const { flows, labels, panel, theme } = sceneRef.current
    applySnapshot(flows, snapshot, theme.flow)
    labels.update(snapshot)
    panel.update(snapshot)
    panel.setLoading({ year: yearReady, month: monthReady })
  }, [snapshot, yearReady, monthReady])

  return (
    <div id="app" ref={appRef}>
      <main className="stage" ref={stageRef}>
        <div className="viewport" id="viewport" ref={viewportRef}>
          <canvas id="scene-canvas" ref={canvasRef} />
        </div>
      </main>

      <div className="loading-screen" ref={loadingScreenRef}>
        <div className="loading-screen__inner">
          <div className="loading-screen__title">Cargando escena</div>
          <div className="loading-bar">
            <div className="loading-bar__fill" ref={loadingFillRef} />
          </div>
          <div className="loading-screen__pct" ref={loadingPctRef}>
            0 %
          </div>
        </div>
      </div>

      <aside id="inspector" className="inspector" ref={inspectorRef} hidden>
        <header className="inspector__header">
          <h1 className="inspector__title">Inspeccion del modelo</h1>
          <button
            type="button"
            className="inspector__close"
            aria-label="Cerrar"
            onClick={() => inspectorRef.current?.setAttribute('hidden', '')}
          >
            x
          </button>
        </header>
        <div className="inspector__body" ref={inspectorBodyRef} />
      </aside>

      <div className="stats" ref={statsRef} hidden />
    </div>
  )
}
