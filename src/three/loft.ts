import * as THREE from 'three'

// A lofted hull: cross-section stations along the body, skinned into one
// continuous surface. This is how an airframe is actually modelled, and it is
// what gives compound curvature — intersecting primitives cannot produce the
// shoulder and nose blends that make a fuselage read as real.

export type Station={
  /** position along the body (+X is nose) */
  x:number
  /** vertical centre of the section */
  y:number
  /** half width at this station */
  w:number
  /** height above the section centre */
  up:number
  /** depth below the section centre */
  down:number
  /** superellipse exponent above centre; 2 is elliptical, higher is squarer */
  nUp:number
  /** superellipse exponent below centre */
  nDown:number
}

const lerp=(a:number,b:number,t:number)=>a+(b-a)*t

// Catmull-Rom through the station parameters, so the hull flows between the
// stations instead of faceting at each one.
function spline(v0:number,v1:number,v2:number,v3:number,t:number){
  const t2=t*t,t3=t2*t
  return .5*((2*v1)+(-v0+v2)*t+(2*v0-5*v1+4*v2-v3)*t2+(-v0+3*v1-3*v2+v3)*t3)
}

function sampleStations(stations:Station[],steps:number):Station[]{
  const out:Station[]=[]
  const n=stations.length
  const keys:(keyof Station)[]=['x','y','w','up','down','nUp','nDown']
  for(let i=0;i<n-1;i++){
    const a=stations[Math.max(0,i-1)],b=stations[i],c=stations[i+1],d=stations[Math.min(n-1,i+2)]
    const last=i===n-2
    for(let s=0;s<steps+(last?1:0);s++){
      const t=s/steps
      const st={} as Station
      for(const k of keys)st[k]=spline(a[k],b[k],c[k],d[k],t)
      out.push(st)
    }
  }
  return out
}

/**
 * Superellipse point at parametric angle `t`, measured from starboard (+Z)
 * through vertical (+Y). Top and bottom halves carry their own exponent so a
 * hull can be domed above and flat-bottomed below.
 */
function profilePoint(st:Station,t:number,out:THREE.Vector3){
  const cz=Math.cos(t),cy=Math.sin(t)
  const n=cy>=0?st.nUp:st.nDown
  const h=cy>=0?st.up:st.down
  const e=2/n
  const z=st.w*Math.sign(cz)*Math.pow(Math.abs(cz),e)
  const y=h*Math.sign(cy)*Math.pow(Math.abs(cy),e)
  out.set(st.x,st.y+y,z)
  return out
}

export type LoftOptions={
  /** angular samples around each section */
  radial?:number
  /** interpolated sections between each pair of key stations */
  steps?:number
  /** close the forward end into a point */
  capFront?:boolean
  /** close the aft end into a point */
  capBack?:boolean
  /** texture repeats along the body and around it */
  uvRepeat?:[number,number]
}

export function loft(stations:Station[],opts:LoftOptions={}){
  const radial=opts.radial??64
  const steps=opts.steps??6
  const [ru,rv]=opts.uvRepeat??[1,1]
  const rows=sampleStations(stations,steps)
  const rowCount=rows.length

  const positions:number[]=[]
  const uvs:number[]=[]
  const indices:number[]=[]
  const p=new THREE.Vector3()

  for(let i=0;i<rowCount;i++){
    for(let j=0;j<=radial;j++){
      const t=(j/radial)*Math.PI*2
      profilePoint(rows[i],t,p)
      positions.push(p.x,p.y,p.z)
      uvs.push((j/radial)*ru,(i/(rowCount-1))*rv)
    }
  }

  const stride=radial+1
  for(let i=0;i<rowCount-1;i++){
    for(let j=0;j<radial;j++){
      const a=i*stride+j,b=a+1,c=a+stride,d=c+1
      indices.push(a,c,b, b,c,d)
    }
  }

  // Caps collapse the end rows onto their section centre.
  const cap=(rowIndex:number,forward:boolean)=>{
    const st=rows[rowIndex]
    const centre=positions.length/3
    positions.push(st.x,st.y,0)
    uvs.push(.5,forward?0:rv)
    for(let j=0;j<radial;j++){
      const a=rowIndex*stride+j,b=a+1
      if(forward)indices.push(centre,b,a)
      else indices.push(centre,a,b)
    }
  }
  if(opts.capFront)cap(rowCount-1,true)
  if(opts.capBack)cap(0,false)

  const g=new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/**
 * A patch lying on the hull: same station profiles, restricted to a station and
 * angular range and pushed out by `offset`. Windscreens, cabin windows, doors
 * and trim built this way follow the skin's curvature exactly instead of
 * floating near it as separate boxes.
 */
export function panel(stations:Station[],xFrom:number,xTo:number,tFrom:number,tTo:number,offset=.012,opts:{radial?:number,steps?:number}={}){
  const radial=opts.radial??26
  const steps=opts.steps??18
  const positions:number[]=[]
  const uvs:number[]=[]
  const indices:number[]=[]
  const lo=Math.min(xFrom,xTo),hi=Math.max(xFrom,xTo)
  const rows=rowsFor(stations)
  const p=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3()

  for(let i=0;i<=steps;i++){
    const x=lo+(hi-lo)*(i/steps)
    const st=stationAt(rows,x)
    for(let j=0;j<=radial;j++){
      const t=tFrom+(tTo-tFrom)*(j/radial)
      profilePoint(st,t,p)
      // Surface normal from the two tangents: around the section, and along it.
      profilePoint(st,t+.002,a)
      profilePoint(stationAt(rows,x+(hi-lo)*.002+.001),t,b)
      const n=a.sub(p).cross(b.sub(p)).normalize()
      // face away from the section centre
      if(n.y*(p.y-st.y)+n.z*p.z<0)n.negate()
      positions.push(p.x+n.x*offset,p.y+n.y*offset,p.z+n.z*offset)
      uvs.push(j/radial,i/steps)
    }
  }
  const stride=radial+1
  for(let i=0;i<steps;i++){
    for(let j=0;j<radial;j++){
      const a=i*stride+j,b=a+1,c=a+stride,d=c+1
      indices.push(a,c,b, b,c,d)
    }
  }
  const g=new THREE.BufferGeometry()
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Interpolated station at an arbitrary x, from an already-sampled row set. */
function stationAt(rows:Station[],x:number):Station{
  let lo=0,hi=rows.length-1
  for(let k=0;k<rows.length-1;k++){
    if((rows[k].x>=x&&rows[k+1].x<=x)||(rows[k].x<=x&&rows[k+1].x>=x)){lo=k;hi=k+1;break}
  }
  const a=rows[lo],b=rows[hi]
  const span=b.x-a.x
  const f=Math.abs(span)<1e-6?0:(x-a.x)/span
  return{
    x,
    y:lerp(a.y,b.y,f),
    w:lerp(a.w,b.w,f),
    up:lerp(a.up,b.up,f),
    down:lerp(a.down,b.down,f),
    nUp:lerp(a.nUp,b.nUp,f),
    nDown:lerp(a.nDown,b.nDown,f),
  }
}

// Sampling the spline is the expensive part, so results are memoised per
// station set rather than recomputed for every vertex.
const rowCache=new WeakMap<Station[],Station[]>()
function rowsFor(stations:Station[]){
  let r=rowCache.get(stations)
  if(!r){r=sampleStations(stations,24);rowCache.set(stations,r)}
  return r
}

/**
 * Surface point on a lofted hull, for placing fittings exactly on the skin
 * rather than floating near it.
 */
export function surfaceAt(stations:Station[],x:number,t:number){
  return profilePoint(stationAt(rowsFor(stations),x),t,new THREE.Vector3())
}
