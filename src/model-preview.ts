import * as THREE from 'three'
import { buildAircraft, MAIN_ROTOR_RPM, TAIL_ROTOR_RPM, ROTOR_PLANE } from './three/aircraft'
import { skyEnvironment } from './three/surfacing'

// Dev-only harness: four fixed viewpoints in one canvas, so the mesh can be
// judged from several angles per screenshot. Query params:
//   ?spin=0   freeze the rotors
//   ?view=n   render a single viewpoint full-frame

const params=new URLSearchParams(location.search)
const spin=params.get('spin')!=='0'
const single=params.get('view')?Number(params.get('view')):null

const canvas=document.createElement('canvas')
document.body.appendChild(canvas)
const renderer=new THREE.WebGLRenderer({canvas,antialias:true})
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.02
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap

const scene=new THREE.Scene()
const env=skyEnvironment(renderer)
scene.environment=env.texture
scene.background=new THREE.Color(0x8fa3b5)

const key=new THREE.DirectionalLight(0xfff4de,3.4)
key.position.set(22,26,18)
key.castShadow=true
key.shadow.mapSize.set(2048,2048)
key.shadow.camera.near=1
key.shadow.camera.far=80
const sc=key.shadow.camera as THREE.OrthographicCamera
sc.left=-9;sc.right=9;sc.top=9;sc.bottom=-9
key.shadow.bias=-.0008
scene.add(key)
scene.add(new THREE.HemisphereLight(0xd6e8f8,0x5d6570,1.1))
const fill=new THREE.DirectionalLight(0xd8e8f8,.8)
fill.position.set(-18,5,22)
scene.add(fill)

const aircraft=buildAircraft(14,5)
aircraft.root.traverse(o=>{
  const m=o as THREE.Mesh
  if(m.isMesh&&!(m.material as THREE.Material).transparent){m.castShadow=true;m.receiveShadow=true}
})
scene.add(aircraft.root)

// yaw, pitch of the orbit, and distance
const VIEWS:[number,number,number][]=[
  [-0.85,0.10,17],   // front three-quarter, the hero angle
  [ 1.95,0.16,17],   // rear three-quarter, shows the shrouded tail rotor
  [ 0.00,0.06,18],   // side profile
  [-1.55,0.42,16],   // front, slightly above
]

const camera=new THREE.PerspectiveCamera(38,1,.5,300)
const target=new THREE.Vector3(0,1.6,0)

function place(yaw:number,pitch:number,dist:number){
  camera.position.set(
    target.x+Math.sin(yaw)*Math.cos(pitch)*dist,
    target.y+Math.sin(pitch)*dist,
    target.z+Math.cos(yaw)*Math.cos(pitch)*dist,
  )
  camera.lookAt(target)
}

const MAIN_RATE=(MAIN_ROTOR_RPM/60)*Math.PI*2
const TAIL_RATE=(TAIL_ROTOR_RPM/60)*Math.PI*2
const MAIN_SHUTTER=(Math.PI*2/5)*.9
const TAIL_SHUTTER=(Math.PI*2/10)*.95
let mainAngle=.4,tailAngle=.2,last=performance.now()

function spinTo(m:number,t:number){
  aircraft.head.rotation.y=m
  aircraft.bladeGhosts.forEach((s,i)=>{s.rotation.y=m-(i/aircraft.bladeGhosts.length)*MAIN_SHUTTER})
  aircraft.tailGhosts.forEach((s,i)=>{s.rotation.z=t-(i/aircraft.tailGhosts.length)*TAIL_SHUTTER})
}

function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000)
  last=now
  if(spin){
    mainAngle=(mainAngle+MAIN_RATE*dt)%(Math.PI*2)
    tailAngle=(tailAngle+TAIL_RATE*dt)%(Math.PI*2)
  }
  spinTo(mainAngle,tailAngle)

  const w=canvas.clientWidth,h=canvas.clientHeight
  if(canvas.width!==w*renderer.getPixelRatio()||canvas.height!==h*renderer.getPixelRatio())renderer.setSize(w,h,false)

  renderer.setScissorTest(true)
  const cells=single!==null?[[0,0,w,h,single]]:[
    [0,h/2,w/2,h/2,0],[w/2,h/2,w/2,h/2,1],
    [0,0,w/2,h/2,2],[w/2,0,w/2,h/2,3],
  ]
  for(const [x,y,cw,ch,vi] of cells as number[][]){
    renderer.setViewport(x,y,cw,ch)
    renderer.setScissor(x,y,cw,ch)
    camera.aspect=cw/ch
    camera.updateProjectionMatrix()
    const [yaw,pitch,dist]=VIEWS[vi]
    place(yaw,pitch,dist)
    renderer.render(scene,camera)
  }
  renderer.setScissorTest(false)
  requestAnimationFrame(frame)
}
void ROTOR_PLANE
requestAnimationFrame(frame)
