import * as THREE from 'three'

// Procedural surfacing. Untextured PBR reads as plastic no matter how good the
// silhouette is, so the hull carries panel lines, fastener rows and roughness
// variation generated at load rather than shipped as image assets.

function canvas(size:number){
  const c=document.createElement('canvas')
  c.width=c.height=size
  return c
}

/** Height field -> tangent-space normal map. */
function toNormalMap(height:Uint8ClampedArray,size:number,strength:number){
  const out=new Uint8ClampedArray(size*size*4)
  const at=(x:number,y:number)=>height[((y+size)%size*size+(x+size)%size)*4]
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const dx=(at(x+1,y)-at(x-1,y))/255*strength
      const dy=(at(x,y+1)-at(x,y-1))/255*strength
      let nx=-dx,ny=-dy,nz=1
      const len=Math.hypot(nx,ny,nz)
      nx/=len;ny/=len;nz/=len
      const i=(y*size+x)*4
      out[i]=(nx*.5+.5)*255
      out[i+1]=(ny*.5+.5)*255
      out[i+2]=(nz*.5+.5)*255
      out[i+3]=255
    }
  }
  return out
}

type PanelOptions={
  size?:number
  /** panel seams running around the body (in UV u) */
  rings?:number[]
  /** panel seams running along the body (in UV v) */
  stringers?:number[]
  rivets?:boolean
  strength?:number
}

export type Surface={normalMap:THREE.CanvasTexture,roughnessMap:THREE.CanvasTexture}

export function panelSurface(opts:PanelOptions={}):Surface{
  const size=opts.size??1024
  const strength=opts.strength??2.6
  const h=canvas(size)
  const hx=h.getContext('2d')
  if(!hx)throw new Error('2d context unavailable')

  hx.fillStyle='#808080'
  hx.fillRect(0,0,size,size)

  // Seams are drawn as a dark groove with a light lip, which is what reads as a
  // pressed panel edge once it becomes a normal map.
  const groove=(x0:number,y0:number,x1:number,y1:number)=>{
    hx.strokeStyle='#5a5a5a';hx.lineWidth=2.2
    hx.beginPath();hx.moveTo(x0,y0);hx.lineTo(x1,y1);hx.stroke()
    hx.strokeStyle='#9a9a9a';hx.lineWidth=1
    hx.beginPath();hx.moveTo(x0,y0-1.6);hx.lineTo(x1,y1-1.6);hx.stroke()
  }

  for(const v of opts.rings??[]) groove(0,v*size,size,v*size)
  for(const u of opts.stringers??[]) groove(u*size,0,u*size,size)

  if(opts.rivets!==false){
    hx.fillStyle='#6e6e6e'
    for(const v of opts.rings??[]){
      for(let x=6;x<size;x+=13){
        hx.beginPath();hx.arc(x,v*size+5,1.15,0,Math.PI*2);hx.fill()
      }
    }
    for(const u of opts.stringers??[]){
      for(let y=6;y<size;y+=13){
        hx.beginPath();hx.arc(u*size+5,y,1.15,0,Math.PI*2);hx.fill()
      }
    }
  }

  // Low-amplitude noise so large panels are not perfectly flat.
  const img=hx.getImageData(0,0,size,size)
  for(let i=0;i<img.data.length;i+=4){
    const n=(Math.random()-.5)*9
    img.data[i]+=n;img.data[i+1]+=n;img.data[i+2]+=n
  }
  hx.putImageData(img,0,0)

  const nData=toNormalMap(hx.getImageData(0,0,size,size).data,size,strength)
  const n=canvas(size)
  const nx=n.getContext('2d')
  if(nx)nx.putImageData(new ImageData(nData,size,size),0,0)
  const normalMap=new THREE.CanvasTexture(n)
  normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping

  // Roughness: paint is not uniform. Seams and a soft blotch pattern break up
  // the specular so highlights travel across the hull instead of sitting still.
  const r=canvas(size)
  const rx=r.getContext('2d')
  if(rx){
    rx.fillStyle='#4a4a4a'
    rx.fillRect(0,0,size,size)
    for(let i=0;i<70;i++){
      const g=rx.createRadialGradient(Math.random()*size,Math.random()*size,2,Math.random()*size,Math.random()*size,60+Math.random()*130)
      g.addColorStop(0,'rgba(255,255,255,.055)')
      g.addColorStop(1,'rgba(255,255,255,0)')
      rx.fillStyle=g
      rx.fillRect(0,0,size,size)
    }
    rx.strokeStyle='rgba(255,255,255,.2)';rx.lineWidth=2.4
    for(const v of opts.rings??[]){rx.beginPath();rx.moveTo(0,v*size);rx.lineTo(size,v*size);rx.stroke()}
    for(const u of opts.stringers??[]){rx.beginPath();rx.moveTo(u*size,0);rx.lineTo(u*size,size);rx.stroke()}
  }
  const roughnessMap=new THREE.CanvasTexture(r)
  roughnessMap.wrapS=roughnessMap.wrapT=THREE.RepeatWrapping

  return {normalMap,roughnessMap}
}

/**
 * Sky-dome environment. RoomEnvironment lights a product shot; an aircraft
 * against open sky needs a bright upper hemisphere, a warm sun lobe and a
 * darker ground bounce or the top surfaces never separate from the underside.
 */
export function skyEnvironment(renderer:THREE.WebGLRenderer,sunAzimuth=.9,sunElevation=.62){
  const size=256
  const c=canvas(size)
  const ctx=c.getContext('2d')
  if(ctx){
    const g=ctx.createLinearGradient(0,0,0,size)
    g.addColorStop(0,'#5d82ad')
    g.addColorStop(.40,'#9db6cb')
    g.addColorStop(.52,'#dfe6e6')
    g.addColorStop(.56,'#b9b3a4')
    g.addColorStop(1,'#59554c')
    ctx.fillStyle=g
    ctx.fillRect(0,0,size,size)
    // sun lobe
    const sx=((sunAzimuth%1)+1)%1*size
    const sy=(1-sunElevation)*size*.5
    const sun=ctx.createRadialGradient(sx,sy,2,sx,sy,size*.26)
    sun.addColorStop(0,'rgba(255,246,222,1)')
    sun.addColorStop(.28,'rgba(255,238,205,.55)')
    sun.addColorStop(1,'rgba(255,236,200,0)')
    ctx.fillStyle=sun
    ctx.fillRect(0,0,size,size)
    // a few soft cloud bands to give the gloss something to catch
    ctx.globalAlpha=.3
    for(let i=0;i<9;i++){
      const y=size*(.12+Math.random()*.3)
      const cg=ctx.createRadialGradient(Math.random()*size,y,4,Math.random()*size,y,40+Math.random()*70)
      cg.addColorStop(0,'rgba(255,255,255,.85)')
      cg.addColorStop(1,'rgba(255,255,255,0)')
      ctx.fillStyle=cg
      ctx.fillRect(0,0,size,size)
    }
    ctx.globalAlpha=1
  }
  const tex=new THREE.CanvasTexture(c)
  tex.mapping=THREE.EquirectangularReflectionMapping
  tex.colorSpace=THREE.SRGBColorSpace
  const pmrem=new THREE.PMREMGenerator(renderer)
  const target=pmrem.fromEquirectangular(tex)
  tex.dispose()
  return {texture:target.texture,dispose:()=>{target.dispose();pmrem.dispose()}}
}
