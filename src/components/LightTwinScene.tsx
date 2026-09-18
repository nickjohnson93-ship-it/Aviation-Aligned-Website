import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { loadLightTwin } from '../three/lightTwin'
import { poseAt, STILL_POSE, aircraftOpacity } from '../three/choreography'
import { createExhaustAirflow } from '../three/exhaustAirflow'
import AircraftSceneStatus from './AircraftSceneStatus'
import AircraftStartup from './AircraftStartup'

export default function LightTwinScene({ progressRef, exhaustEnabled = true }: { progressRef: MutableRefObject<number>; exhaustEnabled?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const exhaustEnabledRef = useRef(exhaustEnabled)
  const airflowRef = useRef<ReturnType<typeof createExhaustAirflow> | null>(null)
  useEffect(() => {
    exhaustEnabledRef.current = exhaustEnabled
    airflowRef.current?.setEnabled(exhaustEnabled)
  }, [exhaustEnabled])
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // Short photographic exposure retains individual blade trails rather than
    // integrating a full, opaque-looking rotor disc. Geometry remains 3D.
    const samples = 48
    const tailSamples = 12
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }) }
    catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.4 : 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = .95
    // One bounded self-shadow pass supplies depth under cabin and fittings.
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.className = 'flight-canvas'
    host.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 150)
    camera.position.set(0, 1.95, 0)
    camera.rotation.x = .022
    const key = new THREE.DirectionalLight(0xffedd5, 2.6)
    const keyOffset = new THREE.Vector3(18, 22, 18)
    key.position.set(18, 22, 18)
    key.castShadow = true
    key.shadow.mapSize.set(window.innerWidth < 760 ? 1024 : 2048, window.innerWidth < 760 ? 1024 : 2048)
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 65 })
    key.shadow.bias = -.0005
    key.shadow.normalBias = .012
    scene.add(key, key.target, new THREE.HemisphereLight(0xdce7ed, 0x263e51, .35))
    const fill = new THREE.DirectionalLight(0xb8d3e7, .3)
    fill.position.set(-15, 7, 16); scene.add(fill)
    let aircraft: Awaited<ReturnType<typeof loadLightTwin>> | undefined
    let environment: THREE.WebGLRenderTarget | undefined
    let alive = true, enabled = false, visible = true, frame = 0, reach = 1
    let mainAngle = .4, tailAngle = .2, last = performance.now()
    let meterStarted = last, meterFrames = 0
    const pmrem = new THREE.PMREMGenerator(renderer)
    const resize = () => {
      const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
      reach = camera.aspect < 1.35 ? Math.min(2.15, 1 + (1.35 - camera.aspect) * 1.05) : 1
    }
    resize()
    const paint = () => {
      if (!aircraft || !alive) return
      const opacity = motion.matches ? 1 : aircraftOpacity(progressRef.current)
      renderer.domElement.style.opacity = String(opacity)
      host.dataset.renderActive = String(opacity > .002)
      // The pinned host stays in view for the plane/logo phases. Do not keep
      // spending GPU time rendering the already-invisible helicopter.
      if (opacity <= .002) return
      const p = progressRef.current, pose = motion.matches ? STILL_POSE : poseAt(p)
      aircraft.root.scale.setScalar(1.45)
      const compositionShift = camera.aspect < .8 ? 1.15 : .8
      aircraft.root.position.set((pose.x + compositionShift) * reach, pose.y - 3.2, pose.z * .83 * reach)
      aircraft.root.rotation.order = 'YZX'
      aircraft.root.rotation.set(pose.roll, pose.yaw, pose.pitch)
      key.target.position.copy(aircraft.root.position)
      key.position.copy(aircraft.root.position).add(keyOffset)
      aircraft.head.rotation.y = mainAngle
      // Approximately 15.8 ms exposure at 400 rpm, centred on the current pose.
      // Reduced-motion displays actual stationary blades, with no blur trails.
      const shutter = motion.matches ? 0 : .42
      aircraft.bladeGhosts.forEach((g, i) => { g.rotation.y = mainAngle - (((i + .5) / samples) - .5) * Math.PI / 2 * shutter })
      aircraft.tailGhosts.forEach((g, i) => { g.rotation.z = -tailAngle - (((i + .5) / tailSamples) - .5) * Math.PI / 5 })
      aircraft.updateRotorInstances()
      renderer.domElement.style.opacity = String(motion.matches ? 1 : aircraftOpacity(p))
      airflowRef.current?.setEnabled(exhaustEnabledRef.current && !motion.matches)
      airflowRef.current?.update(performance.now() / 1000)
      host.dataset.exhaustAirflow = String(exhaustEnabledRef.current && !motion.matches)
      renderer.render(scene, camera)
      host.dataset.mainRotorAngle = mainAngle.toFixed(4)
      host.dataset.tailRotorAngle = tailAngle.toFixed(4)
      host.dataset.drawCalls = String(renderer.info.render.calls)
      host.dataset.meshTriangles = String(renderer.info.render.triangles)
    }
    const stop = () => { if (frame) cancelAnimationFrame(frame); frame = 0 }
    const tick = (now: number) => {
      frame = 0
      if (!alive || !enabled || !visible || document.hidden || motion.matches) return
      const dt = Math.min(.05, (now - last) / 1000); last = now
      mainAngle = (mainAngle + dt * 400 / 60 * Math.PI * 2) % (Math.PI * 2)
      tailAngle = (tailAngle + dt * 3480 / 60 * Math.PI * 2) % (Math.PI * 2)
      paint(); frame = requestAnimationFrame(tick)
      if (aircraftOpacity(progressRef.current) <= .002) { stop(); return }
      meterFrames++
      if (now - meterStarted > 1000) {
        host.dataset.measuredFps = (meterFrames * 1000 / (now - meterStarted)).toFixed(1)
        meterStarted = now; meterFrames = 0
      }
    }
    const start = () => { if (!frame && alive && enabled && visible && !document.hidden && !motion.matches && aircraftOpacity(progressRef.current) > .002) { last = performance.now(); meterStarted = last; meterFrames = 0; frame = requestAnimationFrame(tick) } }
    const refresh = () => { stop(); paint(); start() }
    const onResize = () => { resize(); paint() }
    const onScroll = () => {
      if (frame || !enabled) return
      // The hero progress is updated in an earlier queued animation frame.
      // This also resumes the aircraft when scrolling back into its phase.
      frame = requestAnimationFrame(() => { frame = 0; paint(); start() })
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop() }, { rootMargin: '100px' })
    observer.observe(host)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', refresh)
    motion.addEventListener('change', refresh)
    const onLost = (event: Event) => { event.preventDefault(); enabled = false; stop(); setFailed(true); setReady(false) }
    renderer.domElement.addEventListener('webglcontextlost', onLost)
    const skyPromise = new RGBELoader().loadAsync('/campaign/light-twin/flight-sky-1k.hdr').then(texture => {
      if (!alive) { texture.dispose(); return }
      environment = pmrem.fromEquirectangular(texture); texture.dispose(); scene.environment = environment.texture
    })
    const modelPromise = loadLightTwin(samples, tailSamples).then(model => {
      if (!alive) { model.dispose(); return }
      aircraft = model; scene.add(model.root)
      const airframe = model.root.getObjectByName('LightTwin_Aircraft')!
      const airflow = createExhaustAirflow(airframe)
      airframe.add(airflow.root); airflowRef.current = airflow
      airflow.setEnabled(exhaustEnabledRef.current && !motion.matches)
      host.dataset.modelVersion = String(airframe.userData.productionRefinement)
    })
    Promise.all([skyPromise, modelPromise]).then(() => {
      if (!alive) return
      enabled = true; setReady(true); paint(); start()
    }).catch(error => { if (alive) { console.warn('Light-twin preview unavailable', error); enabled = false; stop(); setFailed(true) } })
    return () => {
      alive = false; stop(); observer.disconnect()
      window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', refresh); motion.removeEventListener('change', refresh)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      airflowRef.current?.dispose(); airflowRef.current = null
      aircraft?.dispose(); key.shadow.dispose(); environment?.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [progressRef])
  return <><div ref={hostRef} className={`flight-scene light-twin-scene${ready && !failed ? ' is-ready' : ' is-loading'}`} role="img" aria-label={ready&&!failed?'A rigged EC135-class light twin helicopter approaching and banking right, with main and ducted tail rotors turning':failed?'Current EC135-class helicopter static preview; 3D unavailable':'EC135-class helicopter, static first frame while 3D loads'}>
    <AircraftStartup/>
  </div>{(!ready || failed) && <AircraftSceneStatus failed={failed}/>}</>
}
