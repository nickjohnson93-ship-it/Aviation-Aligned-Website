/** Small reverse-livery monogram traced from the existing Aviation Aligned
 * reverse JPG. The gold swept arrow is part of the mark, not a generic A.
 * Clips the original curved skin triangles: no billboard or raster texture.
 */
import * as THREE from 'three'

type Vertex = { p: THREE.Vector3; n: THREE.Vector3 }
type Point = [number, number]

// Coordinates in public/brand/aviation-aligned-logo-reverse.jpg (249 x 214).
// Only the monogram is used; no wordmark, background or JPEG edge fringes.
const white: Point[][] = [
  [[124, 11], [135, 11], [163, 66], [143, 73], [129, 42], [111, 80], [82, 90]],
  [[154, 87], [171, 82], [191, 124], [169, 124]],
]
const gold: Point[][] = [
  [[38, 115], [219, 57], [110, 107], [87, 124], [64, 116]],
]
const WIDTH = .36
const CENTER = new THREE.Vector2(-.95, 2.69)
const OFFSET = .0012

function clip(poly: Vertex[], a: THREE.Vector2, b: THREE.Vector2, orientation: number) {
  const field = (p: THREE.Vector3) => orientation * ((b.x-a.x)*(p.y-a.y) - (b.y-a.y)*(p.x-a.x))
  const out: Vertex[] = []
  for (let i=0; i<poly.length; i++) {
    const start=poly[i], end=poly[(i+1)%poly.length], sa=field(start.p), sb=field(end.p)
    if (sa >= -1e-10) out.push(start)
    if ((sa >= 0) !== (sb >= 0)) {
      const t=sa/(sa-sb)
      out.push({p:start.p.clone().lerp(end.p,t),n:start.n.clone().lerp(end.n,t).normalize()})
    }
  }
  return out
}

function artworkTriangles(polygons: Point[][], side: number) {
  return polygons.flatMap(poly => {
    const outline=poly.map(([x,y])=>new THREE.Vector2(CENTER.x+side*(x-128.5)*WIDTH/181, CENTER.y+(67.5-y)*WIDTH/181))
    return THREE.ShapeUtils.triangulateShape(outline,[]).map(ids=>ids.map(id=>outline[id]))
  })
}

/** Returns an unattached group. Call before paint clipping, on source skin. */
export function addAircraftBrand(airframe: THREE.Object3D) {
  const group=new THREE.Group()
  group.name='Aviation_Aligned_Reverse_A_Monogram'
  airframe.updateMatrixWorld(true)
  const inverse=airframe.matrixWorld.clone().invert()
  const skin: THREE.Mesh[]=[]
  airframe.traverse(o=>{if(o instanceof THREE.Mesh && /^nonIBF$/i.test(o.name))skin.push(o)})
  const materials=[
    new THREE.MeshPhysicalMaterial({name:'Aviation Aligned reverse white aircraft marking',color:'#f5f5f0',metalness:.05,roughness:.30,clearcoat:.3,clearcoatRoughness:.2,side:THREE.DoubleSide}),
    new THREE.MeshPhysicalMaterial({name:'Aviation Aligned champagne gold flight-arrow marking',color:'#b89e68',metalness:.65,roughness:.30,clearcoat:.3,clearcoatRoughness:.2,side:THREE.DoubleSide}),
  ]
  const sideCounts={left:0,right:0}
  for(const [slot,polygons] of [white,gold].entries()) {
    const artworkLeft=artworkTriangles(polygons,1),artworkRight=artworkTriangles(polygons,-1),positions:number[]=[],normals:number[]=[]
    for(const mesh of skin) {
      const transform=inverse.clone().multiply(mesh.matrixWorld),normalMatrix=new THREE.Matrix3().getNormalMatrix(transform)
      const p=mesh.geometry.getAttribute('position'), n=mesh.geometry.getAttribute('normal'),idx=mesh.geometry.index
      const count=idx?.count??p.count
      for(let i=0;i<count;i+=3) {
        const source=[0,1,2].map(k=>{const id=idx?idx.getX(i+k):i+k;return {
          p:new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(transform),
          n:new THREE.Vector3().fromBufferAttribute(n,id).applyMatrix3(normalMatrix).normalize(),
        }})
        const center=source.reduce((sum,v)=>sum.add(v.p),new THREE.Vector3()).multiplyScalar(1/3)
        const normal=source.reduce((sum,v)=>sum.add(v.n),new THREE.Vector3()).normalize()
        // Side cowling only: exclude opposite/internal/roof-facing triangles.
        if(Math.abs(center.z)<.35 || normal.z*center.z<.12)continue
        const xs=source.map(v=>v.p.x),ys=source.map(v=>v.p.y)
        if(Math.max(...xs)<CENTER.x-WIDTH*.55||Math.min(...xs)>CENTER.x+WIDTH*.55||Math.max(...ys)<CENTER.y-.12||Math.min(...ys)>CENTER.y+.12)continue
        // Maintain the existing reverse mark's viewer-readable orientation on
        // either side, rather than mirror its chiral swept arrow to the viewer.
        for(const triangle of center.z>0?artworkLeft:artworkRight) {
          const [a,b,c]=triangle, orientation=Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))
          let poly=source
          for(let edge=0;edge<3 && poly.length;edge++)poly=clip(poly,triangle[edge],triangle[(edge+1)%3],orientation)
          for(let j=1;j<poly.length-1;j++) {
            const vertices=[poly[0],poly[j],poly[j+1]]
            if(vertices[1].p.clone().sub(vertices[0].p).cross(vertices[2].p.clone().sub(vertices[0].p)).lengthSq()<1e-16)continue
            for(const v of vertices) {
              const point=v.p.clone().addScaledVector(v.n,OFFSET)
              positions.push(point.x,point.y,point.z);normals.push(v.n.x,v.n.y,v.n.z)
            }
            if(center.z>0)sideCounts.left++;else sideCounts.right++
          }
        }
      }
    }
    if(!positions.length)throw new Error('Aircraft monogram misses the source cowling')
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
    geometry.computeBoundingBox();geometry.computeBoundingSphere()
    const mesh=new THREE.Mesh(geometry,materials[slot])
    mesh.name=slot?'Surface-conformed gold flight-arrow':'Surface-conformed reverse white A'
    mesh.castShadow=false;mesh.receiveShadow=true
    group.add(mesh)
  }
  if(!sideCounts.left||!sideCounts.right)throw new Error('Aircraft monogram must conform to both side surfaces')
  group.userData.brandQA={reference:'public/brand/aviation-aligned-logo-reverse.jpg',monogramOnly:true,colors:'reverse white / champagne gold',centerXY:CENTER.toArray(),widthMetres:WIDTH,offsetMm:OFFSET*1000,placement:'aft navy cowling at user-indicated shoulder location',surfaceClipped:true,sideTriangleCounts:sideCounts,drawCalls:2}
  return group
}
