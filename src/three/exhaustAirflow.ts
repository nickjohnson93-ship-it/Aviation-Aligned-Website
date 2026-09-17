/** Optional, removable exhaust-air cue. This is softly moving transparent air,
 * not smoke, flame, or physical screen-space refraction of the CSS landscape.
 * It owns only its mesh/material; no source geometry or rotor state is changed.
 */
import * as THREE from 'three'

const LENGTH = .95
const MAX_OPACITY = .032
const SEGMENTS = 20

function beneathRotor(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (/^(MainRotor_RIG|TailRotor_RIG)$/.test(ancestor.name)) return true
  }
  return false
}

/** Measure the aft portion of the existing mirrored EC135 exhaust mesh rather
 * than placing an invented emitter at the engine fairing's bounding-box centre.
 */
function measureOutlets(airframe: THREE.Object3D) {
  const exhaust = airframe.getObjectByName('exhaust')
  if (!(exhaust instanceof THREE.Mesh) || beneathRotor(exhaust)) return []
  const position = exhaust.geometry.getAttribute('position')
  if (!position) return []
  airframe.updateMatrixWorld(true)
  const transform = airframe.matrixWorld.clone().invert().multiply(exhaust.matrixWorld)
  const unique = new Map<string, THREE.Vector3>()
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(transform)
    if (![point.x, point.y, point.z].every(Number.isFinite)) continue
    const key = [point.x, point.y, point.z].map(value => Math.round(value * 100000)).join(',')
    unique.set(key, point)
  }
  const emitters: THREE.Vector3[] = []
  for (const side of [-1, 1]) {
    const points = [...unique.values()].filter(point => point.z * side > .001)
    if (points.length < 3) continue
    const bounds = new THREE.Box3().setFromPoints(points)
    const aft = points.filter(point => point.x <= bounds.min.x + (bounds.max.x - bounds.min.x) * .16)
    if (aft.length < 3) continue
    const mouth = new THREE.Box3().setFromPoints(aft).getCenter(new THREE.Vector3())
    // Start just behind the rearmost existing lip, with no opaque attachment.
    mouth.x = bounds.min.x - .018
    emitters.push(mouth)
  }
  return emitters
}

export function createExhaustAirflow(airframe: THREE.Object3D): {
  root: THREE.Group
  update(seconds: number): void
  setEnabled(enabled: boolean): void
  dispose(): void
} {
  const root = new THREE.Group()
  root.name = 'Optional_Exhaust_Airflow'
  const emitters = measureOutlets(airframe)
  const positions: number[] = [], outlets: number[] = [], flows: number[] = [], phases: number[] = [], indices: number[] = []
  emitters.forEach((outlet, emitter) => {
    const first = positions.length / 3
    for (let segment = 0; segment <= SEGMENTS; segment++) {
      const progress = segment / SEGMENTS
      for (const side of [-1, 1]) {
        // Position provides accurate finite bounds; the shader rotates the
        // transverse width towards the camera, without a crossed-plane effect.
        positions.push(outlet.x - LENGTH * progress, outlet.y + side * (.047 + .06 * progress), outlet.z)
        outlets.push(outlet.x, outlet.y, outlet.z)
        flows.push(progress, side)
        phases.push(emitter * 2.37)
      }
      if (segment < SEGMENTS) {
        const a = first + segment * 2, b = a + 1, c = a + 2, d = a + 3
        indices.push(a, b, c, b, d, c)
      }
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aOutlet', new THREE.Float32BufferAttribute(outlets, 3))
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 2))
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setIndex(indices)
  if (positions.length) { geometry.computeBoundingBox(); geometry.computeBoundingSphere() }
  const material = new THREE.ShaderMaterial({
    name: 'Subtle transparent exhaust-air wisps',
    transparent: true, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uLength: { value: LENGTH }, uOpacity: { value: MAX_OPACITY },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uLength;
      attribute vec3 aOutlet;
      attribute vec2 aFlow;
      attribute float aPhase;
      varying vec2 vFlow;
      varying float vPhase;
      void main() {
        float u = aFlow.x;
        float growth = smoothstep(0.0, 1.0, u);
        vec3 centre = aOutlet + vec3(-uLength * u,
          0.018 * u + 0.009 * growth * sin(u * 11.0 - uTime * 3.4 + aPhase),
          0.009 * growth * sin(u * 9.0 - uTime * 2.9 + aPhase));
        vec4 viewCentre = modelViewMatrix * vec4(centre, 1.0);
        vec3 axis = mat3(modelViewMatrix) * vec3(-1.0, 0.0, 0.0);
        vec2 screenAxis = axis.xy;
        float projectedLength = length(screenAxis);
        vec3 transverse = projectedLength > 0.0001
          ? vec3(-screenAxis.y, screenAxis.x, 0.0) / projectedLength
          : vec3(1.0, 0.0, 0.0);
        // Carry model scale into the view-aligned width. Perspective projection
        // handles its distance normally; this is not a fixed-size overlay.
        float scale = length((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float width = (0.047 + 0.060 * u) * scale;
        viewCentre.xyz += transverse * aFlow.y * width;
        gl_Position = projectionMatrix * viewCentre;
        vFlow = aFlow; vPhase = aPhase;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vFlow;
      varying float vPhase;
      void main() {
        float u = vFlow.x;
        float drift = 0.14 * u * sin(u * 14.0 - uTime * 4.6 + vPhase);
        float across = vFlow.y + drift;
        float gaussian = exp(-5.5 * across * across);
        float feather = 1.0 - smoothstep(0.55, 1.0, abs(vFlow.y));
        float start = smoothstep(0.0, 0.075, u);
        float dissolve = 1.0 - smoothstep(0.48, 1.0, u);
        float rolling = 0.5 + 0.5 * sin(u * 34.0 - uTime * 9.0 + vPhase);
        float density = 0.43 + 0.57 * rolling * rolling;
        float alpha = uOpacity * gaussian * feather * start * dissolve * density;
        if (alpha < 0.00015) discard;
        // Barely perceptible cool/warm shift suggests moving warm air. There
        // is no grey soot, luminous flame, or artificially dense smoke plume.
        float tint = 0.5 + 0.5 * sin(u * 7.0 - uTime * 1.1 + vPhase);
        vec3 colour = mix(vec3(0.60, 0.70, 0.76), vec3(0.78, 0.74, 0.65), tint * 0.35);
        gl_FragColor = vec4(colour, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'Camera_Facing_Exhaust_Air_Ribbons'
  mesh.frustumCulled = false // The view-aligned vertex width changes its bounds.
  mesh.castShadow = false; mesh.receiveShadow = false
  mesh.renderOrder = -1
  if (emitters.length) root.add(mesh)
  root.visible = emitters.length > 0
  root.userData = {
    effect: 'optional airflow cue, not smoke or physical refraction',
    emitters: emitters.map(point => point.toArray()), direction: [-1, 0, 0],
    downstreamLength: LENGTH, maxOpacity: MAX_OPACITY,
    drawCalls: emitters.length ? 1 : 0, triangles: indices.length / 3,
    enabled: true, sourceUnchanged: true, rotorsUntouched: true,
  }
  let disposed = false
  return {
    root,
    update(seconds: number) {
      if (disposed || !Number.isFinite(seconds)) return
      // Keep the periodic waves numerically stable on long-running pages.
      material.uniforms.uTime.value = Math.max(0, seconds) % 3600
    },
    setEnabled(enabled: boolean) {
      if (disposed) return
      root.visible = enabled && emitters.length > 0
      root.userData.enabled = enabled
    },
    dispose() {
      if (disposed) return
      disposed = true; root.visible = false; root.removeFromParent()
      geometry.dispose(); material.dispose()
    },
  }
}
