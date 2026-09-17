import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'

import { buildAircraft, MAIN_ROTOR_RPM, TAIL_ROTOR_RPM, type Aircraft } from '../three/aircraft'
import { skyEnvironment } from '../three/surfacing'
import { poseAt, STILL_POSE, aircraftOpacity, type Pose } from '../three/choreography'

const MAIN_RATE=(MAIN_ROTOR_RPM/60)*Math.PI*2      // rad/s
const TAIL_RATE=(TAIL_ROTOR_RPM/60)*Math.PI*2
// Each blade sample is a separate transparent draw, so the sample count is the
// main lever on fill cost. Small viewports get a lighter budget.
const LIGHT=typeof window!=='undefined'&&Math.min(window.innerWidth,window.innerHeight)<760
const BLADE_SAMPLES=LIGHT?8:14
const TAIL_SAMPLES=LIGHT?3:5
// One blade passes every 72 degrees, so sampling a 1/60 s exposure across that
// span is what turns five discrete blades into a disc rather than a strobe.
const MAIN_SHUTTER=(Math.PI*2/5)*.9
const TAIL_SHUTTER=(Math.PI*2/10)*.95

export default function FlightScene({progressRef}:{progressRef:MutableRefObject<number>}){
  const hostRef=useRef<HTMLDivElement>(null)
  const [failed,setFailed]=useState(false)

  useEffect(()=>{
    const host=hostRef.current
    if(!host)return

    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)')
    let renderer:THREE.WebGLRenderer
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'})
    }catch{
      setFailed(true)
      return
    }
    if(!renderer.getContext()){
      setFailed(true)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,LIGHT?1.5:1.75))
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=1.08
    renderer.shadowMap.enabled=!LIGHT
    renderer.shadowMap.type=THREE.PCFSoftShadowMap
    renderer.domElement.className='flight-canvas'
    host.appendChild(renderer.domElement)

    const scene=new THREE.Scene()
    const camera=new THREE.PerspectiveCamera(38,1,1,400)
    camera.position.set(0,1.95,0)
    camera.rotation.x=.022

    // Reflections: the navy paint and glazing need an environment to read as
    // painted metal rather than flat colour.
    const env=skyEnvironment(renderer)
    scene.environment=env.texture

    const key=new THREE.DirectionalLight(0xfff2d8,3.8)
    key.position.set(26,26,20)          // upper right, matching the CSS sun
    key.castShadow=!LIGHT
    key.shadow.mapSize.set(1024,1024)
    key.shadow.camera.near=1
    key.shadow.camera.far=120
    const shadowCam=key.shadow.camera as THREE.OrthographicCamera
    shadowCam.left=-14;shadowCam.right=14;shadowCam.top=14;shadowCam.bottom=-14
    key.shadow.bias=-.0012
    scene.add(key)
    scene.add(new THREE.HemisphereLight(0xcadff2,0x59616c,1.25))
    const fill=new THREE.DirectionalLight(0xdce9f6,1.15)
    fill.position.set(-16,4,26)
    scene.add(fill)
    const rim=new THREE.DirectionalLight(0x9fc4e8,1.0)
    rim.position.set(-20,8,-24)
    scene.add(rim)

    const aircraft:Aircraft=buildAircraft(BLADE_SAMPLES,TAIL_SAMPLES)
    aircraft.root.traverse(o=>{
      const m=o as THREE.Mesh
      if(m.isMesh&&m.material&&!(m.material as THREE.Material).transparent){
        m.castShadow=true
        m.receiveShadow=true
      }
    })
    scene.add(aircraft.root)

    let reach=1
    const applyPose=(pose:Pose)=>{
      aircraft.root.position.set(pose.x*reach,pose.y,pose.z*reach)
      aircraft.root.rotation.order='YZX'
      aircraft.root.rotation.set(pose.roll,pose.yaw,pose.pitch)
    }

    const spin=(mainAngle:number,tailAngle:number)=>{
      aircraft.head.rotation.y=mainAngle
      for(let i=0;i<aircraft.bladeGhosts.length;i++){
        aircraft.bladeGhosts[i].rotation.y=mainAngle-(i/BLADE_SAMPLES)*MAIN_SHUTTER
      }
      for(let i=0;i<aircraft.tailGhosts.length;i++){
        aircraft.tailGhosts[i].rotation.z=tailAngle-(i/TAIL_SAMPLES)*TAIL_SHUTTER
      }
    }

    const resize=()=>{
      const w=host.clientWidth||window.innerWidth
      const h=host.clientHeight||window.innerHeight
      renderer.setSize(w,h,false)
      camera.aspect=w/h
      camera.updateProjectionMatrix()
      // Narrow viewports see less width at a given distance, so the aircraft is
      // pushed back instead of the FOV being widened. Perspective stays the
      // same on every device and the 11 m rotor disc still fits on a phone.
      reach=camera.aspect<1.35?Math.min(2,1+(1.35-camera.aspect)*.95):1
    }
    resize()

    let frame=0
    let visible=true
    let running=false
    let last=performance.now()
    let mainAngle=0
    let tailAngle=0

    const renderOnce=()=>{
      const p=progressRef.current
      applyPose(reducedMotion.matches?STILL_POSE:poseAt(p))
      renderer.domElement.style.opacity=String(reducedMotion.matches?1:aircraftOpacity(p))
      renderer.render(scene,camera)
    }

    const tick=(now:number)=>{
      if(!running)return
      const dt=Math.min(.05,(now-last)/1000)
      last=now
      // Rotor speed is driven by elapsed time, not scroll, so the blades keep
      // turning while the visitor is still.
      mainAngle=(mainAngle+MAIN_RATE*dt)%(Math.PI*2)
      tailAngle=(tailAngle+TAIL_RATE*dt)%(Math.PI*2)
      spin(mainAngle,tailAngle)
      renderOnce()
      frame=requestAnimationFrame(tick)
    }

    const start=()=>{
      if(running||reducedMotion.matches||!visible)return
      running=true
      last=performance.now()
      frame=requestAnimationFrame(tick)
    }
    const stop=()=>{
      running=false
      if(frame)cancelAnimationFrame(frame)
      frame=0
    }

    const observer=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting
      if(visible)start()
      else stop()
    },{rootMargin:'160px'})
    observer.observe(host)

    const onResize=()=>{resize();if(!running)renderOnce()}
    window.addEventListener('resize',onResize)

    const onMotionChange=()=>{
      stop()
      if(reducedMotion.matches){spin(.42,.2);renderOnce()}
      else start()
    }
    reducedMotion.addEventListener?.('change',onMotionChange)

    // Paint one frame immediately so the hero is never empty before rAF starts.
    spin(.42,.2)
    renderOnce()
    if(reducedMotion.matches)host.classList.add('is-still')
    else start()

    return()=>{
      stop()
      observer.disconnect()
      window.removeEventListener('resize',onResize)
      reducedMotion.removeEventListener?.('change',onMotionChange)
      scene.traverse(o=>{
        const m=o as THREE.Mesh
        if(!m.isMesh)return
        m.geometry.dispose()
        const mat=m.material
        if(Array.isArray(mat))mat.forEach(x=>x.dispose())
        else mat.dispose()
      })
      env.dispose()
      aircraft.disposeSurfaces()
      renderer.dispose()
      renderer.domElement.remove()
    }
  },[progressRef])

  return <div ref={hostRef} className={`flight-scene${failed?' is-unavailable':''}`} role="img" aria-label="An Airbus H145 helicopter in forward flight, main rotor and Fenestron tail rotor turning, banking away to the right"/>
}
