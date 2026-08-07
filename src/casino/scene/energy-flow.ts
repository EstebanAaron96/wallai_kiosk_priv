import {
  AdditiveBlending,
  Color,
  GreaterDepth,
  LessEqualDepth,
  Mesh,
  NormalBlending,
  Object3D,
  ShaderMaterial,
  TubeGeometry,
  type IUniform,
} from 'three'
import type { FlowCurve, FlowId } from './flow-curves.ts'

/**
 * Energy flows are drawn as tubes carrying travelling pulses rather than
 * particle systems: one draw call each, a constant on-screen width at any
 * distance, and speed/density/brightness that map straight onto shader uniforms.
 *
 * Every flow is two concentric tubes — a thin bright core and a wider soft halo
 * blended additively — which is what gives the neon look without postprocessing.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vRim;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 viewDirection = normalize(-mvPosition.xyz);
    // 0 facing the camera, 1 at the silhouette — used to bias the halo outwards.
    vRim = 1.0 - abs(dot(viewNormal, viewDirection));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  /** Travel distance along the tube, already wrapped to [0,1). */
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uPulses;
  uniform float uIntensity;
  uniform float uDirection;
  uniform float uOpacity;
  uniform float uHalo;
  uniform float uBase;
  uniform float uDim;
  uniform float uLuminous;
  uniform float uRimPow;
  uniform float uRimFloor;

  varying vec2 vUv;
  varying float vRim;

  void main() {
    // Phase is integrated on the CPU, not derived as time × speed. Multiplying a
    // growing clock by a changing speed makes the pulse position jump by the whole
    // elapsed time whenever the speed moves — which is what made the animation
    // stutter and surge as the power readings changed.
    float phase = fract(vUv.x * uPulses - uPhase);

    // Comet profile: a tight bright head with a longer, dimmer trail behind it.
    float head = pow(phase, 18.0);
    float tail = pow(phase, 3.0) * 0.34;
    float pulse = head + tail;

    // Soften both ends so the tube dissolves at the waypoints instead of
    // stopping dead on a hard circular cap.
    float ends = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x);

    // A faint constant strand keeps the topology readable at very low power.
    float energy = (uBase + pulse * uIntensity) * ends;

    // The halo tube is weighted towards the silhouette; the core is uniform.
    // Under alpha the whole halo surface gets painted, so the floor drops to zero
    // and the exponent rises — it becomes an edge highlight, not a wide ribbon.
    float rim = mix(1.0, pow(vRim, uRimPow) + uRimFloor, uHalo);
    float strength = clamp(energy * rim * uOpacity * uDim, 0.0, 1.0);

    // Luminous skin: pulses brighten towards white, because light is being added.
    // Alpha skin: brightness would wash the strand out against a pale backdrop,
    // so the pulse deepens the colour and drives opacity instead.
    vec3 luminous = uColor * (1.0 + pulse * 1.6);
    vec3 inked = mix(uColor, uColor * 0.55, clamp(pulse, 0.0, 1.0));
    vec3 color = mix(inked, luminous, uLuminous);

    // AdditiveBlending is (SrcAlpha, One): the blend already multiplies RGB by
    // the alpha channel. So emit the raw colour with the strength in alpha —
    // premultiplying here too would square it, and forcing alpha to 1 would
    // punch an opaque hole through the backdrop wherever the glow is dim.
    // With normal blending the same output is plain alpha compositing.
    float alpha = mix(min(strength * 2.4, 0.96), strength, uLuminous);
    gl_FragColor = vec4(color, alpha);
  }
`

export interface FlowVisualOptions {
  /** Core tube radius in world units. */
  radius: number
  /** Power that maps to full brightness and top speed, kW. */
  referenceKW?: number
  tubularSegments?: number
}

/** What the data layer tells a flow to do. */
export interface FlowDrive {
  /** Magnitude in kW; 0 fades the flow out. */
  power: number
  /** +1 runs from → to, -1 reverses. */
  direction: 1 | -1
  color: string
}

interface TubeLayer {
  mesh: Mesh
  uniforms: Record<string, IUniform>
}

interface FlowVisual {
  id: FlowId
  layers: TubeLayer[]
  target: { intensity: number; speed: number; pulses: number; opacity: number }
  current: { intensity: number; speed: number; pulses: number; opacity: number }
  direction: 1 | -1
  /** Integrated travel along the tube, wrapped to [0,1) every frame. */
  phase: number
  /** Dips to 0 and back when the direction flips, hiding the reversal. */
  flipBlend: number
  pendingDirection: 1 | -1
  pendingColor: Color
  color: Color
}

type LayerKind = 'halo' | 'core' | 'ghost'

/**
 * Each flow is drawn as three passes:
 *   halo  — wide soft glow, occluded normally
 *   core  — thin bright strand, occluded normally
 *   ghost — the same strand rendered ONLY where geometry hides it (depthFunc
 *           GreaterDepth), dimmed right down
 *
 * Disabling the depth test entirely was the wrong trade: it kept the buried roof
 * runs visible but let every flow float in front of the building. With the ghost
 * pass the flows sit correctly in the scene and the hidden stretches still read
 * as a faint trace, so a route never just vanishes.
 */
function createLayer(
  curve: FlowCurve,
  radius: number,
  radialSegments: number,
  tubularSegments: number,
  kind: LayerKind,
  color: Color,
): TubeLayer {
  const geometry = new TubeGeometry(curve.curve, tubularSegments, radius, radialSegments, false)
  const isHalo = kind === 'halo'
  const isGhost = kind === 'ghost'

  const uniforms: Record<string, IUniform> = {
    uColor: { value: color.clone() },
    uPhase: { value: 0 },
    uSpeed: { value: 0.3 },
    uPulses: { value: 3 },
    uIntensity: { value: 0 },
    uDirection: { value: 1 },
    uOpacity: { value: 0 },
    uHalo: { value: isHalo ? 1 : 0 },
    // Constant strand that keeps the route readable between pulses.
    uBase: { value: isHalo ? 0.06 : 0.1 },
    // Occluded stretches stay legible without competing with the visible ones.
    uDim: { value: isGhost ? 0.28 : 1 },
    uGhost: { value: isGhost ? 1 : 0 },
    uLuminous: { value: 1 },
    uRimPow: { value: 1.5 },
    uRimFloor: { value: 0.3 },
  }

  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    // GreaterDepth draws only what failed the normal depth test — the hidden part.
    depthFunc: isGhost ? GreaterDepth : LessEqualDepth,
    blending: AdditiveBlending,
  })

  const mesh = new Mesh(geometry, material)
  mesh.name = `flow:${curve.id}:${kind}`
  mesh.renderOrder = isGhost ? 9 : isHalo ? 10 : 11
  // The tubes are additive glows; culling them by a stale bounding sphere while
  // the camera orbits close is more likely than a real saving here.
  mesh.frustumCulled = false

  return { mesh, uniforms }
}

export interface EnergyFlowField {
  object: Object3D
  /** Applies new power/direction values; the visual eases towards them. */
  drive(id: FlowId, drive: FlowDrive): void
  /**
   * Switches how the tubes composite. `additive` is a glow that only works over a
   * dark backdrop; `alpha` paints a solid strand for the pale skin, where adding
   * light to near-white would leave nothing visible.
   */
  setBlendMode(mode: 'additive' | 'alpha'): void
  update(deltaSeconds: number): void
  dispose(): void
}

export function createEnergyFlows(
  curves: readonly FlowCurve[],
  options: FlowVisualOptions,
): EnergyFlowField {
  const { radius, referenceKW = 8, tubularSegments = 180 } = options

  const object = new Object3D()
  object.name = 'EnergyFlows'

  const visuals = new Map<FlowId, FlowVisual>()

  for (const curve of curves) {
    const color = new Color('#ffffff')
    const ghost = createLayer(curve, radius, 8, tubularSegments, 'ghost', color)
    const halo = createLayer(curve, radius * 2.1, 12, tubularSegments, 'halo', color)
    const core = createLayer(curve, radius, 8, tubularSegments, 'core', color)
    object.add(ghost.mesh, halo.mesh, core.mesh)

    visuals.set(curve.id, {
      id: curve.id,
      layers: [core, halo, ghost],
      target: { intensity: 0, speed: 0.3, pulses: 3, opacity: 0 },
      current: { intensity: 0, speed: 0.3, pulses: 3, opacity: 0 },
      direction: 1,
      phase: 0,
      flipBlend: 1,
      pendingDirection: 1,
      pendingColor: color.clone(),
      color: color.clone(),
    })
  }

  const approach = (current: number, target: number, rate: number, dt: number): number =>
    current + (target - current) * (1 - Math.exp(-rate * dt))

  return {
    object,

    setBlendMode(mode) {
      const luminous = mode === 'additive'
      for (const visual of visuals.values()) {
        for (const layer of visual.layers) {
          const material = layer.mesh.material as ShaderMaterial
          const isHalo = layer.uniforms['uHalo']!.value === 1
          const isGhost = layer.uniforms['uGhost']!.value === 1

          material.blending = luminous ? AdditiveBlending : NormalBlending
          material.needsUpdate = true
          layer.uniforms['uLuminous']!.value = luminous ? 1 : 0
          // A solid strand needs a stronger constant base than a glow to read.
          layer.uniforms['uBase']!.value = luminous ? (isHalo ? 0.06 : 0.1) : isHalo ? 0.03 : 0.14
          // Under alpha the halo stops being a soft glow and becomes a solid band,
          // so it has to be pulled right back to read as an edge instead.
          const haloDim = luminous ? 1 : 0.55
          layer.uniforms['uDim']!.value = isGhost ? 0.28 : isHalo ? haloDim : 1
          layer.uniforms['uRimPow']!.value = luminous ? 1.5 : 3.2
          layer.uniforms['uRimFloor']!.value = luminous ? 0.3 : 0.0
        }
      }
    },

    drive(id, { power, direction, color }) {
      const visual = visuals.get(id)
      if (!visual) return

      const normalized = Math.min(Math.max(power / referenceKW, 0), 1)
      // Below this the flow is noise, not a reading — let it disappear entirely.
      const live = power > 0.04

      // Power drives pulse amplitude, speed and density. Opacity is only the
      // master on/off (and the direction-flip dip): scaling it by power as well
      // would apply the same factor twice and leave low flows nearly invisible.
      visual.target.intensity = 0.35 + normalized * 0.65
      visual.target.speed = 0.16 + normalized * 0.7
      visual.target.pulses = 2 + normalized * 5
      visual.target.opacity = live ? 1 : 0

      visual.pendingColor.set(color)
      visual.pendingDirection = direction
      if (direction !== visual.direction) visual.flipBlend = 0
      else if (!visual.pendingColor.equals(visual.color)) visual.flipBlend = Math.min(visual.flipBlend, 0.35)
    },

    update(deltaSeconds) {
      for (const visual of visuals.values()) {
        const { current, target } = visual

        current.intensity = approach(current.intensity, target.intensity, 3, deltaSeconds)
        current.speed = approach(current.speed, target.speed, 3, deltaSeconds)
        current.pulses = approach(current.pulses, target.pulses, 2, deltaSeconds)
        current.opacity = approach(current.opacity, target.opacity, 4, deltaSeconds)

        // Swap direction and colour at the bottom of the dip, so the reversal is
        // never visible as pulses snapping the other way mid-tube.
        if (visual.flipBlend < 1) {
          visual.flipBlend = Math.min(1, visual.flipBlend + deltaSeconds * 3.2)
          if (visual.flipBlend >= 0.5) {
            visual.direction = visual.pendingDirection
            visual.color.copy(visual.pendingColor)
          }
        }
        const dip = visual.flipBlend < 1 ? Math.abs(visual.flipBlend * 2 - 1) : 1

        // Wrapping to [0,1) is exact — fract() ignores whole turns — and it keeps
        // float precision constant, instead of decaying over a 24/7 run.
        visual.phase += deltaSeconds * current.speed * visual.direction
        visual.phase -= Math.floor(visual.phase)

        for (const layer of visual.layers) {
          layer.uniforms['uPhase']!.value = visual.phase
          layer.uniforms['uIntensity']!.value = current.intensity
          layer.uniforms['uSpeed']!.value = current.speed
          layer.uniforms['uPulses']!.value = current.pulses
          layer.uniforms['uOpacity']!.value = current.opacity * dip
          layer.uniforms['uDirection']!.value = visual.direction
          ;(layer.uniforms['uColor']!.value as Color).copy(visual.color)
          layer.mesh.visible = current.opacity * dip > 0.002
        }
      }
    },

    dispose() {
      for (const visual of visuals.values()) {
        for (const layer of visual.layers) {
          layer.mesh.geometry.dispose()
          ;(layer.mesh.material as ShaderMaterial).dispose()
        }
      }
      visuals.clear()
    },
  }
}
