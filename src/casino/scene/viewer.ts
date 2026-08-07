import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  Scene,
  Sphere,
  SphereGeometry,
  SRGBColorSpace,
  TOUCH,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { createBackdropTexture } from './backdrop.ts'
import { THEMES, type Theme, type ThemeName } from '../config/themes.ts'
import { applyEnvironment, createEnvironment, type GeneratedEnvironment } from './environment.ts'
import { palette } from '../config/theme.ts'

/** Direction of the key light, shared with the procedural sky so highlights agree. */
export const SUN_DIRECTION = new Vector3(0.55, 0.72, 0.42).normalize()

export interface ViewerOptions {
  /** Slow idle orbit for unattended kiosk playback. */
  autoRotate?: boolean
  /** Seconds for one full there-and-back sweep. */
  orbitPeriodSeconds?: number
  /** Seconds of inactivity before the idle orbit resumes after a manual drag. */
  resumeAfterSeconds?: number
  /**
   * Half-width in degrees of the *idle* azimuth sweep around the hero angle.
   * This bounds the unattended motion and the framing, not what a hand can do:
   * manual rotation is unrestricted, so the model can be shown from any side.
   */
  azimuthSweepDegrees?: number
  /** Initial optical-centring offset, as fractions of the viewport. */
  compositionX?: number
  compositionY?: number
  /** Allow dragging the model around — needed on a touch panel. */
  enablePan?: boolean
  /**
   * How far the model may be dragged from its framed position, as a fraction of
   * the scene radius. Without a bound a visitor can flick the model off-screen
   * and leave an empty kiosk behind.
   */
  maxPanRadius?: number
  /** Seconds of stillness before the view eases back to its framed composition. */
  returnHomeAfterSeconds?: number
  /**
   * Hero viewpoint, in degrees. Azimuth 0 looks down +Z; it increases towards +X.
   * Elevation is measured up from the horizon.
   */
  heroAzimuthDegrees?: number
  heroElevationDegrees?: number
  /** Which skin to start on. */
  theme?: ThemeName
}

export interface Viewer {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  labelRenderer: CSS2DRenderer
  controls: OrbitControls
  /** Frames the camera on an object and re-tunes the orbit limits around it. */
  frame(target: Object3D, distanceFactor?: number): void
  /** Re-applies the last framing — used after an orientation change. */
  refit(): void
  /**
   * Shifts the model within the viewport without changing the viewing angle.
   * Values are fractions of the viewport: +x moves the model right, +y up.
   * Needed because the bounding-box centre is not the optical centre — the small
   * substation drags the geometric centre west of where the mass actually reads.
   */
  setComposition(offset: { x?: number; y?: number }): void
  nudgeComposition(dx: number, dy: number): void
  getComposition(): { x: number; y: number }
  /** Live hero-angle override, for dialling the viewpoint in. */
  setHeroAngle(azimuthDegrees: number, elevationDegrees: number): void
  /** Swaps the 3D half of the skin: backdrop and exposure. */
  setTheme(name: ThemeName): Theme
  getTheme(): Theme
  /** Distance multiplier applied on top of the computed fit. */
  setZoom(distanceFactor: number): void
  getZoom(): number
  setAutoRotate(enabled: boolean): void
  isAutoRotating(): boolean
  onFrame(callback: (deltaSeconds: number, elapsedSeconds: number) => void): () => void
  start(): void
  dispose(): void
}

export function createViewer(canvas: HTMLCanvasElement, options: ViewerOptions = {}): Viewer {
  const {
    autoRotate = true,
    orbitPeriodSeconds = 150,
    resumeAfterSeconds = 12,
    azimuthSweepDegrees = 32,
    compositionX: composeX = 0,
    compositionY: composeY = 0,
    enablePan = true,
    maxPanRadius = 1.1,
    returnHomeAfterSeconds = 30,
    heroAzimuthDegrees = 43,
    heroElevationDegrees = 20,
    theme: initialTheme = 'dark',
  } = options

  /**
   * Hero viewpoint. Every waypoint except the panel rows sits on the west side of
   * the site — the junction, the load and the grid tower — so the camera has to
   * stand on that side or the whole energy chain plays out on the far face.
   */
  let heroAzimuth = (heroAzimuthDegrees * Math.PI) / 180
  let heroPolar = Math.PI / 2 - (heroElevationDegrees * Math.PI) / 180
  const HERO_DIRECTION = new Vector3()
  const updateHeroDirection = (): void => {
    HERO_DIRECTION.set(
      Math.sin(heroPolar) * Math.sin(heroAzimuth),
      Math.cos(heroPolar),
      Math.sin(heroPolar) * Math.cos(heroAzimuth),
    ).normalize()
  }
  updateHeroDirection()
  const sweep = (azimuthSweepDegrees * Math.PI) / 180

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = THEMES[initialTheme].exposure

  const scene = new Scene()
  let activeTheme: Theme = THEMES[initialTheme]
  let backdrop = createBackdropTexture(activeTheme.backdrop)
  scene.background = backdrop

  const camera = new PerspectiveCamera(38, 1, 0.01, 200)
  camera.position.set(4, 3, 4)

  // CSS2D labels live in a sibling overlay so they inherit page CSS and stay crisp.
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.className = 'label-layer'
  canvas.parentElement?.insertBefore(labelRenderer.domElement, canvas.nextSibling)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = enablePan
  // Pan parallel to the screen: on a touch panel, dragging should move the model
  // the way the finger moves, not along the ground plane.
  controls.screenSpacePanning = true
  // One finger turns the model, two pan and pinch — the gestures people already try.
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
  controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
  // The idle motion is driven manually below, not by controls.autoRotate: with a
  // clamped azimuth range autoRotate walks into the limit and stops there for good.
  controls.autoRotate = false
  // Manual rotation is free all the way round — clamping the azimuth here is what
  // made the model feel stuck when someone was showing it. The idle sweep is
  // bounded separately, in the frame loop. Only the poles stay limited: below the
  // horizon you see the underside of the scan, and straight down loses the scene.
  controls.minPolarAngle = 0.16
  controls.maxPolarAngle = Math.PI / 2 - 0.04
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity

  // --- Lighting rig -------------------------------------------------------
  // The environment map does most of the work; these add shape and contrast.
  const environment: GeneratedEnvironment = createEnvironment(renderer, { sunDirection: SUN_DIRECTION })
  applyEnvironment(scene, environment)

  const hemisphere = new HemisphereLight(0xdfe9fb, 0x26324c, 0.55)
  scene.add(hemisphere)

  const ambient = new AmbientLight(0xffffff, 0.25)
  scene.add(ambient)

  const key = new DirectionalLight(0xfff6e2, 1.6)
  key.position.copy(SUN_DIRECTION).multiplyScalar(10)
  scene.add(key)

  // Cool rim from the opposite side to separate the model from the backdrop.
  const rim = new DirectionalLight(0xbcd4ff, 0.5)
  rim.position.set(-SUN_DIRECTION.x * 8, 3, -SUN_DIRECTION.z * 8)
  scene.add(rim)

  const callbacks = new Set<(dt: number, t: number) => void>()

  // --- Idle orbit and return-to-home --------------------------------------
  // A sine sweep between the azimuth limits: it eases out at each end and turns
  // around instead of stalling, and never needs a hard direction flip.
  let autoRotateWanted = autoRotate
  let orbitActive = autoRotate
  let orbitPhase = 0
  let idleSeconds = 0
  let interacting = false

  /** The framed pose the view drifts back to once the panel is left alone. */
  const home = { target: new Vector3(), position: new Vector3(), radius: 1 }
  /** Progress of the ease back home, 0..1. Null while not returning. */
  let returning: number | null = null
  const returnFrom = { target: new Vector3(), position: new Vector3() }

  /** Re-derives the sweep phase from wherever the user left the camera. */
  function syncOrbitPhase(): void {
    const offset = (controls.getAzimuthalAngle() - heroAzimuth) / sweep
    orbitPhase = Math.asin(Math.max(-1, Math.min(1, offset)))
  }

  function beginInteraction(): void {
    interacting = true
    orbitActive = false
    returning = null
  }

  function endInteraction(): void {
    if (!interacting) return
    interacting = false
    idleSeconds = 0
  }

  controls.addEventListener('start', beginInteraction)
  controls.addEventListener('end', endInteraction)

  /**
   * OrbitControls does not always pair 'start' with 'end'. Lifting one finger of
   * a two-finger gesture leaves it without an 'end', and the idle orbit then never
   * resumes — the panel simply stops moving and stays that way. So the authority
   * on "is a hand on the glass" is the pointer count, not the control's events.
   */
  const activePointers = new Set<number>()
  let lastControlsChange = performance.now()
  /** How long a motionless "interaction" may block the idle orbit. */
  const IDLE_WATCHDOG_MS = 5000

  const onPointerDown = (event: PointerEvent): void => {
    activePointers.add(event.pointerId)
    beginInteraction()
  }
  const onPointerRelease = (event: PointerEvent): void => {
    activePointers.delete(event.pointerId)
    if (activePointers.size === 0) endInteraction()
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerRelease)
  window.addEventListener('pointercancel', onPointerRelease)
  // Losing the window mid-gesture drops the pointer events entirely.
  window.addEventListener('blur', () => {
    activePointers.clear()
    endInteraction()
  })

  controls.addEventListener('change', () => {
    lastControlsChange = performance.now()
  })

  /**
   * Keeps the pan within reach of the framed pose. OrbitControls has no bound of
   * its own, so without this a single flick can push the model off the panel and
   * leave the kiosk showing an empty backdrop until someone notices.
   */
  function clampPan(): void {
    const limit = home.radius * maxPanRadius
    const drift = new Vector3().subVectors(controls.target, home.target)
    const distance = drift.length()
    if (distance <= limit) return
    const correction = drift.setLength(distance - limit)
    controls.target.sub(correction)
    camera.position.sub(correction)
  }

  /** True once the view sits far enough from home to be worth easing back. */
  function isAwayFromHome(): boolean {
    return (
      controls.target.distanceToSquared(home.target) > (home.radius * 0.004) ** 2 ||
      Math.abs(camera.position.distanceTo(controls.target) - home.position.distanceTo(home.target)) >
        home.radius * 0.02
    )
  }

  // --- Framing ------------------------------------------------------------
  let framed: { target: Object3D; distanceFactor: number } | null = null
  /** Optical-centring offset, as fractions of the viewport. Survives refits. */
  const composition = { x: composeX, y: composeY }

  /**
   * Distance at which the box fits the frustum from *every* azimuth the idle
   * orbit will pass through.
   *
   * A bounding sphere is far too loose for a wide, flat site like this one, and
   * fitting only the current view makes the model breathe as it rotates. So the
   * box corners are projected onto the camera basis at sampled azimuths and the
   * tightest distance that still fits them all wins.
   */
  function orbitSafeDistance(box: Box3, center: Vector3, polarAngle: number, samples = 24): number {
    const corners: Vector3[] = []
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z).sub(center))
      }
    }

    const halfFov = (camera.fov * Math.PI) / 360
    // An off-centre composition leaves less room on the tighter side: shifting by
    // a fraction f of the viewport costs 2f of the usable width, so the fit has to
    // pull back by the same amount or the model clips off the edge.
    const usableH = Math.max(0.2, 1 - 2 * Math.abs(composition.x))
    const usableV = Math.max(0.2, 1 - 2 * Math.abs(composition.y))
    const tanV = Math.tan(halfFov) * usableV
    const tanH = Math.tan(halfFov) * Math.max(camera.aspect, 0.0001) * usableH

    const direction = new Vector3()
    const right = new Vector3()
    const up = new Vector3()
    const worldUp = new Vector3(0, 1, 0)
    let required = 0

    for (let i = 0; i <= samples; i += 1) {
      // Only the azimuths the idle orbit can actually reach.
      const azimuth = heroAzimuth - sweep + (i / samples) * sweep * 2
      direction
        .set(Math.sin(polarAngle) * Math.sin(azimuth), Math.cos(polarAngle), Math.sin(polarAngle) * Math.cos(azimuth))
        .normalize()
      right.crossVectors(worldUp, direction).normalize()
      up.crossVectors(direction, right).normalize()

      // A corner at depth `z` toward the camera fits when |x| <= (d - z)·tanH,
      // so it needs d >= |x|/tanH + z. Evaluated per corner — taking the widest
      // corner and the nearest corner separately would over-estimate.
      for (const corner of corners) {
        const x = Math.abs(corner.dot(right))
        const y = Math.abs(corner.dot(up))
        const z = corner.dot(direction)
        required = Math.max(required, x / tanH + z, y / tanV + z)
      }
    }

    return required
  }

  function applyFraming(): void {
    if (!framed) return
    const box = new Box3().setFromObject(framed.target)
    if (box.isEmpty()) return

    const center = box.getCenter(new Vector3())
    const sphere = box.getBoundingSphere(new Sphere())
    const direction = HERO_DIRECTION
    const distance = orbitSafeDistance(box, center, heroPolar) * framed.distanceFactor

    // Slide the whole view sideways/vertically so the model sits where it reads
    // best. Camera and orbit target move together, so the angle is untouched and
    // the composition holds while the idle orbit sweeps.
    if (composition.x !== 0 || composition.y !== 0) {
      const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
      const visibleWidth = visibleHeight * camera.aspect
      const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize()
      const up = new Vector3().crossVectors(direction, right).normalize()
      // Moving the view right pushes the model left, hence the negated offsets.
      center.addScaledVector(right, -composition.x * visibleWidth)
      center.addScaledVector(up, -composition.y * visibleHeight)
    }

    camera.position.copy(center).addScaledVector(direction, distance)
    camera.near = Math.max(distance / 500, 0.01)
    camera.far = distance * 12
    camera.updateProjectionMatrix()

    controls.target.copy(center)
    controls.minDistance = sphere.radius * 0.28
    controls.maxDistance = distance * 3.0
    controls.update()

    // Remember the framed pose so a visitor's dragging can be undone later.
    home.target.copy(center)
    home.position.copy(camera.position)
    home.radius = sphere.radius
    returning = null

    // Scale the light rig to the model so it never falls inside it.
    key.position.copy(center).addScaledVector(SUN_DIRECTION, sphere.radius * 4)
    rim.position.copy(center).addScaledVector(SUN_DIRECTION, -sphere.radius * 3).setY(center.y + sphere.radius)
  }

  function resize(): void {
    const { clientWidth, clientHeight } = canvas
    if (clientWidth === 0 || clientHeight === 0) return
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
      renderer.setSize(clientWidth, clientHeight, false)
      labelRenderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      // Re-fit so an orientation change keeps the model correctly framed.
      applyFraming()
    }
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  let running = false
  let last = performance.now()
  let elapsed = 0

  function tick(now: number): void {
    if (!running) return
    requestAnimationFrame(tick)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    elapsed += dt

    // Watchdog. A gesture can be left open two ways: the control never fires
    // 'end' (lifting one finger of a two-finger gesture does exactly this), or the
    // panel reports a touch that never lifts at all — a smudge, a drop of water, a
    // stuck digitiser. Both freeze a public screen for good, so the test is simply
    // "nothing has moved in a while", regardless of what claims to be touching the
    // glass. Any real drag fires 'change' and resets the timer.
    if (interacting && now - lastControlsChange > IDLE_WATCHDOG_MS) {
      activePointers.clear()
      endInteraction()
    }

    if (!interacting) {
      idleSeconds += dt

      // Someone dragged or pinched the model: ease the whole pose back to the
      // framed composition before picking the idle orbit up again, so the panel
      // always recovers on its own.
      if (returning === null && idleSeconds >= returnHomeAfterSeconds && isAwayFromHome()) {
        returning = 0
        returnFrom.target.copy(controls.target)
        returnFrom.position.copy(camera.position)
        orbitActive = false
      }

      if (returning !== null) {
        returning = Math.min(1, returning + dt / 1.6)
        const eased = 1 - (1 - returning) ** 3
        controls.target.lerpVectors(returnFrom.target, home.target, eased)
        camera.position.lerpVectors(returnFrom.position, home.position, eased)
        if (returning >= 1) {
          returning = null
          idleSeconds = resumeAfterSeconds
        }
      } else if (autoRotateWanted && !orbitActive && idleSeconds >= resumeAfterSeconds) {
        syncOrbitPhase()
        orbitActive = true
      }

      if (orbitActive && returning === null) {
        orbitPhase += (dt * Math.PI * 2) / orbitPeriodSeconds
        const desired = heroAzimuth + Math.sin(orbitPhase) * sweep
        // Steer towards the target angle rather than setting it: the delta still
        // runs through OrbitControls' damping, so manual drags blend in smoothly.
        // The error is wrapped to ±π because the azimuth is no longer clamped —
        // otherwise returning from the far side would take the long way round.
        let error = desired - controls.getAzimuthalAngle()
        error -= Math.PI * 2 * Math.round(error / (Math.PI * 2))
        // rotateLeft() subtracts from theta, hence the negated error.
        controls.rotateLeft(-error)
      }
    }

    resize()
    controls.update()
    // After update(), never before: OrbitControls applies the damped pan inside
    // update(), so clamping first just gets overwritten on the same frame.
    if (returning === null) clampPan()

    for (const callback of callbacks) callback(dt, elapsed)
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  return {
    scene,
    camera,
    renderer,
    labelRenderer,
    controls,

    frame(target, distanceFactor = 1.12) {
      framed = { target, distanceFactor }
      applyFraming()
    },

    refit() {
      applyFraming()
    },

    setComposition({ x, y }) {
      if (x !== undefined) composition.x = x
      if (y !== undefined) composition.y = y
      applyFraming()
    },

    nudgeComposition(dx, dy) {
      composition.x += dx
      composition.y += dy
      applyFraming()
    },

    getComposition: () => ({ ...composition }),

    setTheme(name) {
      activeTheme = THEMES[name]
      backdrop.dispose()
      backdrop = createBackdropTexture(activeTheme.backdrop)
      scene.background = backdrop
      renderer.toneMappingExposure = activeTheme.exposure
      return activeTheme
    },

    getTheme: () => activeTheme,

    setHeroAngle(azimuthDegrees, elevationDegrees) {
      heroAzimuth = (azimuthDegrees * Math.PI) / 180
      heroPolar = Math.PI / 2 - (elevationDegrees * Math.PI) / 180
      updateHeroDirection()
      controls.minAzimuthAngle = heroAzimuth - sweep
      controls.maxAzimuthAngle = heroAzimuth + sweep
      applyFraming()
    },

    setZoom(distanceFactor) {
      if (framed) framed.distanceFactor = distanceFactor
      applyFraming()
    },

    getZoom: () => framed?.distanceFactor ?? 1,

    setAutoRotate(enabled) {
      autoRotateWanted = enabled
      idleSeconds = 0
      if (enabled) syncOrbitPhase()
      orbitActive = enabled
    },

    isAutoRotating: () => orbitActive,

    onFrame(callback) {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },

    start() {
      if (running) return
      running = true
      last = performance.now()
      requestAnimationFrame(tick)
    },

    dispose() {
      running = false
      callbacks.clear()
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerRelease)
      window.removeEventListener('pointercancel', onPointerRelease)
      controls.dispose()
      environment.dispose()
      backdrop.dispose()
      renderer.dispose()
      labelRenderer.domElement.remove()
    },
  }
}

export const EMPTY_COLORS: Record<string, string> = {
  PV1: palette.solar,
  PV2: palette.solarBright,
  'PV-Juntas': palette.accent,
  Load: palette.production,
  Grid: palette.grid,
}

/**
 * Spheres + CSS2D labels marking each Empty, drawn on top of the model
 * (`depthTest: false`) so waypoints buried inside the building stay visible
 * while the mapping is being confirmed.
 */
export function createEmptyMarkers(empties: Map<string, Object3D>, radius: number): Object3D {
  const group = new Object3D()
  group.name = 'EmptyMarkers'

  const geometry = new SphereGeometry(radius, 20, 16)
  for (const [name, object] of empties) {
    const color = new Color(EMPTY_COLORS[name] ?? palette.white)
    const marker = new Mesh(geometry, new MeshBasicMaterial({ color, depthTest: false, toneMapped: false }))
    marker.name = `marker:${name}`
    marker.renderOrder = 999
    marker.position.copy(object.getWorldPosition(new Vector3()))

    const element = document.createElement('span')
    element.className = 'waypoint-label'
    element.textContent = name
    element.style.setProperty('--waypoint-color', EMPTY_COLORS[name] ?? palette.white)
    const label = new CSS2DObject(element)
    label.position.set(0, radius * 2.2, 0)
    marker.add(label)

    group.add(marker)
  }
  return group
}
