import * as THREE from 'three'
import { loft, panel, surfaceAt, type Station } from './loft'
import { panelSurface, type Surface } from './surfacing'

// A generic twin-engine light helicopter — no manufacturer's type is
// reproduced. Dimensions follow the class: 12.9 m overall, 10.8 m main rotor,
// 4.0 m high, shrouded tail rotor, skid gear.
//
// The hull is a lofted surface built from cross-section stations (see loft.ts),
// which is what produces the shoulder, nose and boom blends. Glazing, doors and
// trim are patches lying on that same surface, so nothing floats.

export const ROTOR_RADIUS=5.4
export const ROTOR_PLANE=3.30
export const MAIN_ROTOR_RPM=398
export const TAIL_ROTOR_RPM=3480
const MAST_X=.55
const TAIL_X=-7.28
const TAIL_Y=2.40

// nose-first; x descends aft
const HULL:Station[]=[
  {x: 5.42,y: .86,w: .12,up: .12,down: .12,nUp:2.1,nDown:2.1},
  {x: 5.16,y: .86,w: .44,up: .36,down: .38,nUp:2.2,nDown:2.2},
  {x: 4.72,y: .90,w: .80,up: .62,down: .62,nUp:2.3,nDown:2.3},
  {x: 4.12,y: .95,w:1.03,up: .88,down: .80,nUp:2.5,nDown:2.4},
  {x: 3.38,y:1.00,w:1.14,up:1.10,down: .88,nUp:2.8,nDown:2.6},
  {x: 2.52,y:1.02,w:1.16,up:1.22,down: .92,nUp:3.2,nDown:2.9},
  {x: 1.38,y:1.04,w:1.16,up:1.26,down: .94,nUp:3.6,nDown:3.1},
  {x: 0.08,y:1.06,w:1.15,up:1.26,down: .94,nUp:3.6,nDown:3.1},
  {x:-1.06,y:1.14,w:1.08,up:1.20,down: .88,nUp:3.4,nDown:3.0},
  {x:-1.96,y:1.34,w: .88,up:1.00,down: .70,nUp:3.0,nDown:2.8},
  {x:-2.70,y:1.56,w: .62,up: .72,down: .50,nUp:2.6,nDown:2.5},
  {x:-3.60,y:1.74,w: .44,up: .48,down: .40,nUp:2.3,nDown:2.3},
  {x:-5.00,y:1.88,w: .34,up: .36,down: .32,nUp:2.2,nDown:2.2},
  {x:-6.40,y:1.94,w: .27,up: .29,down: .26,nUp:2.1,nDown:2.1},
  {x:-7.60,y:1.97,w: .23,up: .25,down: .23,nUp:2.1,nDown:2.1},
]

// engine deck sitting on the cabin roof
const DECK:Station[]=[
  {x: 2.42,y:2.12,w: .46,up: .10,down: .52,nUp:2.6,nDown:2.6},
  {x: 1.72,y:2.10,w: .84,up: .22,down: .60,nUp:3.0,nDown:2.8},
  {x:  .80,y:2.11,w: .94,up: .30,down: .64,nUp:3.3,nDown:3.0},
  {x: -.42,y:2.11,w: .94,up: .30,down: .64,nUp:3.3,nDown:3.0},
  {x:-1.32,y:2.08,w: .78,up: .22,down: .60,nUp:2.9,nDown:2.8},
  {x:-2.05,y:2.04,w: .42,up: .12,down: .50,nUp:2.5,nDown:2.5},
]

let hullSurface:Surface|undefined
let trimSurface:Surface|undefined

function surfaces(){
  if(!hullSurface){
    hullSurface=panelSurface({
      rings:[.08,.17,.255,.35,.44,.57,.70,.83],
      stringers:[.25,.75],
      strength:2.4,
    })
    hullSurface.normalMap.repeat.set(3,1)
    hullSurface.roughnessMap.repeat.set(3,1)
  }
  if(!trimSurface){
    trimSurface=panelSurface({rings:[.3,.7],stringers:[],rivets:false,strength:1.4,size:512})
  }
  return {hull:hullSurface,trim:trimSurface}
}

function materials(){
  const {hull,trim}=surfaces()
  const paint=(color:number,roughness:number,metalness:number)=>new THREE.MeshPhysicalMaterial({
    color,metalness,roughness,
    normalMap:hull.normalMap,
    normalScale:new THREE.Vector2(.55,.55),
    roughnessMap:hull.roughnessMap,
    clearcoat:.7,
    clearcoatRoughness:.2,
    envMapIntensity:.92,
  })
  return {
    navy:paint(0x0b1828,.34,.13),
    navyDeep:paint(0x060f1b,.40,.12),
    deck:paint(0x081420,.46,.15),
    gold:new THREE.MeshPhysicalMaterial({color:0xbe9a2c,metalness:.85,roughness:.22,clearcoat:.9,clearcoatRoughness:.1,envMapIntensity:1.6}),
    glass:new THREE.MeshPhysicalMaterial({color:0x05090f,metalness:0,roughness:.14,clearcoat:.35,clearcoatRoughness:.1,envMapIntensity:.22,reflectivity:.4}),
    graphite:new THREE.MeshStandardMaterial({color:0x22262b,metalness:.42,roughness:.56,normalMap:trim.normalMap,normalScale:new THREE.Vector2(.3,.3)}),
    steel:new THREE.MeshStandardMaterial({color:0x8a939d,metalness:.94,roughness:.26,envMapIntensity:1.5}),
    blade:new THREE.MeshPhysicalMaterial({color:0x191d22,metalness:.2,roughness:.52,clearcoat:.6,clearcoatRoughness:.3}),
    trimDark:new THREE.MeshStandardMaterial({color:0x0c141d,metalness:.3,roughness:.5}),
    warn:new THREE.MeshStandardMaterial({color:0xcfd2d0,metalness:.2,roughness:.62}),
    beacon:new THREE.MeshStandardMaterial({color:0xff4a33,emissive:0xff2a14,emissiveIntensity:2.6,roughness:.4}),
    lens:new THREE.MeshPhysicalMaterial({color:0xf3f0e4,metalness:.1,roughness:.08,clearcoat:1,emissive:0xfff4d8,emissiveIntensity:.35}),
  }
}

function mesh(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){
  const o=new THREE.Mesh(g,m)
  o.position.set(x,y,z)
  return o
}

function tube(r0:number,r1:number,len:number,seg=20){return new THREE.CylinderGeometry(r0,r1,len,seg,1,false)}

// A cylinder spanning two points. Gear members are defined by where they start
// and end, which is far more reliable than composing rotations.
function strut(m:THREE.Material,from:THREE.Vector3,to:THREE.Vector3,radius:number,seg=12){
  const dir=to.clone().sub(from)
  const len=dir.length()
  const o=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,seg,1,false),m)
  o.position.copy(from).addScaledVector(dir,.5)
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize())
  return o
}

// Chord-wise elliptical thickness with outboard taper and a little washout.
function aerofoil(span:number,chord:number,thick:number,taper=1,twist=0){
  const g=new THREE.BoxGeometry(chord,thick,span,14,3,28)
  const p=g.attributes.position as THREE.BufferAttribute
  const hz=span/2
  const v=new THREE.Vector3()
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i)
    const f=(z+hz)/span
    const s=1-(1-taper)*f
    // Rounded leading edge, sharper trailing edge. The base is clamped at zero:
    // at the chord extremes rounding can take it slightly negative, and a
    // negative base with a fractional exponent yields NaN.
    const c=Math.max(.001,Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/(chord/2),2.0)),.62))
    v.set(x*s,y*c*s,z)
    if(twist){
      const a=twist*f
      const cx=v.x*Math.cos(a)-v.y*Math.sin(a)
      const cy=v.x*Math.sin(a)+v.y*Math.cos(a)
      v.set(cx,cy,v.z)
    }
    p.setXYZ(i,v.x,v.y,v.z)
  }
  g.computeVertexNormals()
  return g
}

function airframe(M:ReturnType<typeof materials>){
  const g=new THREE.Group()

  g.add(mesh(loft(HULL,{radial:76,steps:8,capFront:true,capBack:true,uvRepeat:[1,3]}),M.navy))
  g.add(mesh(loft(DECK,{radial:56,steps:7,capFront:true,capBack:true,uvRepeat:[1,2]}),M.deck))

  // Glazing, laid on the hull surface so it follows the curvature exactly.
  g.add(mesh(panel(HULL,3.05,5.24,.55,Math.PI-.55,.009,{radial:32,steps:22}),M.trimDark))
  g.add(mesh(panel(HULL,3.15,5.20,.62,Math.PI-.62,.016,{radial:32,steps:22}),M.glass))
  g.add(mesh(panel(HULL,3.92,5.28,Math.PI+.66,Math.PI*2-.66,.008,{radial:22,steps:14}),M.trimDark))
  g.add(mesh(panel(HULL,4.00,5.25,Math.PI+.72,Math.PI*2-.72,.014,{radial:22,steps:14}),M.glass))
  // windscreen centre post and surround
  g.add(mesh(panel(HULL,3.15,5.22,Math.PI/2-.04,Math.PI/2+.04,.021,{radial:4,steps:22}),M.trimDark))
  g.add(mesh(panel(HULL,3.10,3.22,.60,Math.PI-.60,.018,{radial:30,steps:3}),M.navyDeep))

  for(const side of [1,-1]){
    const t0=side>0?0:Math.PI
    const dir=side>0?1:-1
    // cabin and door windows
    for(const [xa,xb,ta,tb] of [[1.72,2.60,-.02,.44],[.12,1.26,-.04,.46],[-1.32,-.42,0,.40]] as number[][]){
      g.add(mesh(panel(HULL,xa-.07,xb+.07,t0-dir*(ta+.05),t0+dir*(tb+.05),.010,{radial:18,steps:14}),M.trimDark))
      g.add(mesh(panel(HULL,xa,xb,t0-dir*ta,t0+dir*tb,.016,{radial:18,steps:14}),M.glass))
    }
    // sliding-door surround
    g.add(mesh(panel(HULL,-.06,1.42,t0-dir*.58,t0-dir*.52,.016,{radial:4,steps:16}),M.trimDark))
    g.add(mesh(panel(HULL,-.06,1.42,t0+dir*.40,t0+dir*.46,.016,{radial:4,steps:16}),M.trimDark))
    // gold cheatline, following the hull
    g.add(mesh(panel(HULL,-2.20,4.30,t0-dir*.94,t0-dir*.86,.015,{radial:5,steps:30}),M.gold))
    g.add(mesh(panel(HULL,-2.20,4.30,t0-dir*.845,t0-dir*.825,.016,{radial:3,steps:30}),M.navyDeep))
  }

  // engine intakes and exhausts
  for(const z of [-1,1]){
    g.add(mesh(panel(DECK,1.18,1.86,z>0?.30:Math.PI-.30,z>0?1.05:Math.PI-1.05,.008,{radial:10,steps:10}),M.trimDark))
    const ex=mesh(tube(.19,.225,.5,18),M.steel,-1.32,2.30,z*.44)
    ex.rotation.z=Math.PI/2
    ex.rotation.y=-.16
    g.add(ex)
  }
  // rotor mast fairing base on the deck
  g.add(mesh(tube(.4,.5,.22,24),M.deck,MAST_X,2.56,0))

  // horizontal stabiliser with endplates
  const stab=mesh(aerofoil(3.10,.82,.12,.78),M.navy,-5.45,1.92,0)
  stab.rotation.z=.02
  g.add(stab)
  for(const z of [-1,1]){
    const ep=mesh(aerofoil(.86,.60,.09,.8),M.navy,-5.45,2.18,z*1.50)
    ep.rotation.x=Math.PI/2
    ep.rotation.z=.04
    g.add(ep)
  }

  // swept fin carrying the shrouded tail rotor
  const fin=new THREE.Shape()
  fin.moveTo(.86,0)
  fin.lineTo(-.86,0)
  fin.lineTo(-1.08,1.06)
  fin.quadraticCurveTo(-.72,1.24,-.28,1.2)
  fin.quadraticCurveTo(.5,1.1,.86,0)
  const finG=new THREE.ExtrudeGeometry(fin,{depth:.17,bevelEnabled:true,bevelSize:.07,bevelThickness:.05,bevelSegments:4,curveSegments:22})
  g.add(mesh(finG,M.navy,TAIL_X+.14,1.80,-.085))
  g.add(mesh(new THREE.SphereGeometry(.065,12,10),M.beacon,TAIL_X-.36,3.10,0))
  // ventral strake
  const strake=new THREE.Shape()
  strake.moveTo(.7,0);strake.lineTo(-.55,0);strake.lineTo(-.3,-.78);strake.quadraticCurveTo(.3,-.72,.7,0)
  g.add(mesh(new THREE.ExtrudeGeometry(strake,{depth:.16,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:3,curveSegments:14}),M.navy,TAIL_X+.5,1.42,-.08))

  // Skid gear: two longitudinal skids, each carried by a pair of trapezoidal
  // cross-frames, with the forward ends swept up.
  const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  const SKID_Y=-1.06,SKID_Z=1.16
  for(const z of [-1,1]){
    g.add(strut(M.graphite,V(-1.00,SKID_Y,z*SKID_Z),V(2.95,SKID_Y,z*SKID_Z),.058,14))
    g.add(strut(M.graphite,V(2.95,SKID_Y,z*SKID_Z),V(3.52,SKID_Y+.24,z*SKID_Z),.055,12))
    g.add(strut(M.graphite,V(3.52,SKID_Y+.24,z*SKID_Z),V(3.86,SKID_Y+.60,z*SKID_Z),.05,12))
    g.add(mesh(new THREE.BoxGeometry(.42,.085,.14),M.graphite,2.05,SKID_Y+.05,z*SKID_Z))
  }
  for(const x of [2.05,-.45]){
    for(const z of [-1,1]){
      g.add(strut(M.graphite,V(x,SKID_Y,z*SKID_Z),V(x,-.30,z*.60),.06,12))
    }
    g.add(strut(M.navyDeep,V(x,-.30,-.62),V(x,-.30,.62),.075,12))
  }

  // landing light, antennas, steps, position lights
  g.add(mesh(new THREE.SphereGeometry(.11,14,12),M.lens,4.68,.30,0))
  g.add(mesh(new THREE.BoxGeometry(.46,.12,.028),M.graphite,-1.0,.06,0))
  g.add(mesh(new THREE.BoxGeometry(.028,.26,.2),M.graphite,-3.2,2.12,0))
  g.add(mesh(new THREE.BoxGeometry(.028,.2,.16),M.graphite,-4.6,2.16,0))
  for(const side of [1,-1]){
    const t0=side>0?0:Math.PI
    const step=surfaceAt(HULL,.9,t0+side*.92)
    g.add(mesh(new THREE.BoxGeometry(.4,.06,.2),M.graphite,step.x,step.y-.06,step.z*1.02))
    const lp=surfaceAt(HULL,1.3,t0)
    g.add(mesh(new THREE.SphereGeometry(.045,10,8),M.warn,lp.x,lp.y,lp.z))
  }

  return g
}

// Non-rotating: mast fairing and the stationary swashplate ring.
function mastStatic(M:ReturnType<typeof materials>){
  const g=new THREE.Group()
  g.position.x=MAST_X
  g.add(mesh(tube(.16,.235,.76,22),M.graphite,0,2.92,0))
  g.add(mesh(new THREE.TorusGeometry(.29,.045,12,28),M.steel,0,3.02,0))
  for(let i=0;i<5;i++){
    const a=(i/5)*Math.PI*2
    g.add(mesh(tube(.016,.016,.3,8),M.steel,Math.cos(a)*.29,3.14,Math.sin(a)*.29))
  }
  return g
}

// Rotating head: hub, grips, flexbeam roots, pitch links, rotating swashplate.
function rotorHead(M:ReturnType<typeof materials>){
  const g=new THREE.Group()
  g.add(mesh(tube(.30,.26,.2,24),M.steel,0,3.26,0))
  g.add(mesh(tube(.355,.355,.075,26),M.graphite,0,3.38,0))
  g.add(mesh(new THREE.SphereGeometry(.185,16,12),M.steel,0,3.44,0))
  g.add(mesh(new THREE.TorusGeometry(.30,.042,12,26),M.steel,0,3.18,0))
  for(let i=0;i<5;i++){
    const a=(i/5)*Math.PI*2,c=Math.cos(a),s=Math.sin(a)
    const grip=mesh(new THREE.BoxGeometry(.56,.13,.17),M.graphite,c*.47,ROTOR_PLANE,s*.47)
    grip.rotation.y=-a
    g.add(grip)
    const root=mesh(new THREE.BoxGeometry(.46,.055,.11),M.graphite,c*.24,ROTOR_PLANE,s*.24)
    root.rotation.y=-a
    g.add(root)
    const link=mesh(tube(.019,.019,.24,8),M.steel,c*.33,3.22,s*.33)
    link.rotation.z=.18*c
    link.rotation.x=-.18*s
    g.add(link)
    const damp=mesh(tube(.035,.035,.2,8),M.graphite,c*.38,3.32,s*.38)
    damp.rotation.z=Math.PI/2
    damp.rotation.y=-a
    g.add(damp)
  }
  return g
}

function bladeSet(M:ReturnType<typeof materials>){
  const g=new THREE.Group()
  const len=ROTOR_RADIUS-.62
  for(let i=0;i<5;i++){
    const arm=new THREE.Group()
    arm.rotation.y=-(i/5)*Math.PI*2
    arm.position.y=ROTOR_PLANE
    arm.rotation.x=-.042                       // coning
    arm.add(mesh(aerofoil(len,.40,.062,.88,-.06),M.blade,0,0,len/2+.62))
    g.add(arm)
  }
  return g
}

// Continuous disc tint. Real rotor blur is a translucent plane denser inboard;
// discrete samples alone read as separate sticks.
function rotorDisc(){
  const c=document.createElement('canvas')
  c.width=c.height=128
  const ctx=c.getContext('2d')
  if(ctx){
    const grad=ctx.createRadialGradient(64,64,5,64,64,64)
    grad.addColorStop(0,'rgba(196,205,216,.55)')
    grad.addColorStop(.45,'rgba(190,199,211,.3)')
    grad.addColorStop(.88,'rgba(186,196,209,.17)')
    grad.addColorStop(1,'rgba(184,194,207,0)')
    ctx.fillStyle=grad
    ctx.fillRect(0,0,128,128)
  }
  const tex=new THREE.CanvasTexture(c)
  tex.colorSpace=THREE.SRGBColorSpace
  const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide})
  const disc=mesh(new THREE.CircleGeometry(ROTOR_RADIUS,72),mat,MAST_X,ROTOR_PLANE,0)
  disc.rotation.x=-Math.PI/2
  return disc
}

function tailShroud(M:ReturnType<typeof materials>){
  const g=new THREE.Group()
  g.position.set(TAIL_X,TAIL_Y,0)
  g.rotation.x=Math.PI/2
  const ring=new THREE.LatheGeometry([
    new THREE.Vector2(.52,.13),new THREE.Vector2(.555,.08),new THREE.Vector2(.565,0),
    new THREE.Vector2(.555,-.08),new THREE.Vector2(.52,-.13),new THREE.Vector2(.72,-.12),
    new THREE.Vector2(.75,0),new THREE.Vector2(.72,.12),new THREE.Vector2(.52,.13),
  ],40)
  g.add(mesh(ring,M.navy))
  g.add(mesh(new THREE.TorusGeometry(.535,.02,10,40),M.trimDark))
  g.add(mesh(new THREE.SphereGeometry(.135,16,12),M.graphite))
  g.add(mesh(tube(.135,.16,.15,16),M.graphite,0,-.08,0))
  for(let i=0;i<7;i++){
    const a=(i/7)*Math.PI*2
    const vane=mesh(new THREE.BoxGeometry(.042,.2,.36),M.graphite,Math.cos(a)*.33,-.07,Math.sin(a)*.33)
    vane.rotation.y=-a
    g.add(vane)
  }
  return g
}

function tailBlades(M:ReturnType<typeof materials>){
  const g=new THREE.Group()
  g.position.set(TAIL_X,TAIL_Y,0)
  g.rotation.x=Math.PI/2
  for(let i=0;i<10;i++){
    const a=(i/10)*Math.PI*2
    const b=mesh(aerofoil(.36,.11,.024,.9),M.blade,Math.cos(a)*.345,.03,Math.sin(a)*.345)
    b.rotation.y=-a
    b.rotation.z=.4
    g.add(b)
  }
  g.add(mesh(tube(.115,.115,.14,14),M.graphite,0,.03,0))
  return g
}

function ghost(group:THREE.Group,lead:boolean,leadOpacity:number,trailOpacity:number){
  group.traverse(o=>{
    const m=o as THREE.Mesh
    if(!m.isMesh)return
    const mat=(m.material as THREE.Material).clone()
    mat.transparent=true
    mat.opacity=lead?leadOpacity:trailOpacity
    // Depth test stays on so a blade behind the boom is occluded; depth write is
    // off so samples accumulate into a disc rather than clipping each other.
    mat.depthWrite=false
    m.material=mat
  })
  return group
}

export type Aircraft={
  root:THREE.Group
  /** hub, grips, pitch links, rotating swashplate; turns with the blades */
  head:THREE.Group
  bladeGhosts:THREE.Group[]
  tailGhosts:THREE.Group[]
  disposeSurfaces:()=>void
}

export function buildAircraft(bladeSamples=14,tailSamples=5):Aircraft{
  const M=materials()
  const root=new THREE.Group()
  root.add(airframe(M))
  root.add(mastStatic(M))
  root.add(tailShroud(M))

  const head=rotorHead(M)
  head.position.x=MAST_X
  root.add(head)
  root.add(rotorDisc())

  const bladeGhosts:THREE.Group[]=[]
  for(let i=0;i<bladeSamples;i++){
    const s=bladeSet(M)
    s.position.x=MAST_X
    root.add(ghost(s,i===0,.15,.07))
    bladeGhosts.push(s)
  }

  const tailGhosts:THREE.Group[]=[]
  for(let i=0;i<tailSamples;i++){
    const s=tailBlades(M)
    root.add(ghost(s,i===0,.42,.22))
    tailGhosts.push(s)
  }

  const disposeSurfaces=()=>{
    hullSurface?.normalMap.dispose()
    hullSurface?.roughnessMap.dispose()
    trimSurface?.normalMap.dispose()
    trimSurface?.roughnessMap.dispose()
    hullSurface=undefined
    trimSurface=undefined
  }

  return {root,head,bladeGhosts,tailGhosts,disposeSurfaces}
}
