/** Visual detail pass on the supplied GPL-2.0 EC135-class mesh.
 * Coordinates retain the source airframe/rotor pivots, not a certified CAD model.
 */
import * as THREE from 'three'
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export function refineLightTwinGeometry(airframe: THREE.Object3D, replaced: THREE.BufferGeometry[]) {
  const details = new THREE.Group()
  details.name = 'Airframe_Refinement_Details'
  const aluminium = new THREE.MeshStandardMaterial({ name: 'Refined skid aluminium', color: '#77828b', metalness: .82, roughness: .31 })
  const rubber = new THREE.MeshStandardMaterial({ name: 'Refined rubber and interior', color: '#10171c', metalness: 0, roughness: .8 })
  const fittings = new THREE.MeshStandardMaterial({ name: 'Refined stationary fittings', color: '#39434a', metalness: .65, roughness: .42 })
  const steel = new THREE.MeshStandardMaterial({ name: 'Refined fastening steel', color: '#a7afb4', metalness: .9, roughness: .26 })
  const pieces = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const list = pieces.get(material) || []
    list.push(geometry); pieces.set(material, list)
  }
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 32) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    add(new THREE.TubeGeometry(curve, segments, radius, 12, false), material)
    // Real end closures rather than visibly open tube mouths.
    for (const point of [points[0], points[points.length - 1]]) {
      add(new THREE.SphereGeometry(radius, 12, 8).translate(point.x, point.y, point.z), material)
    }
  }
  const bolt = (point: THREE.Vector3, direction: THREE.Vector3, radius = .018) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, .014, 6)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), direction.normalize()))
    add(geometry.translate(point.x, point.y, point.z), steel)
  }

  // Preserve aerodynamic curves but stop smoothing across hard equipment edges.
  airframe.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    if (/handle|wirecutter|exhaust|engine|standardstep|mast|swashplate|scissor|pitchlink/.test(object.name)) {
      replaced.push(object.geometry)
      object.geometry = toCreasedNormals(object.geometry, THREE.MathUtils.degToRad(50))
    }
    if (/antenna|wirecutter/.test(object.name)) {
      object.material = fittings
    }
    if (/Cabin seat/.test(object.name)) object.material = rubber
  })

  // Replace low-resolution, lumpy skid rails and joints with smooth tubular
  // rails, two continuous cross-struts, mounting collars and discrete bolts.
  const oldSkid = airframe.getObjectByName('highskid')
  if (oldSkid instanceof THREE.Mesh) {
    oldSkid.visible = false
    for (const side of [-1, 1]) {
      const z = side * 1.22
      tube([v(-.90, .12, z), v(-.74, .066, z), v(.1, .055, z), v(1.55, .055, z), v(2.05, .12, z), v(2.24, .25, z)], .047, aluminium, 64)
      // Thin replaceable wear strips along the contact portion of each rail.
      add(new THREE.BoxGeometry(2.38, .018, .066).translate(.46, .006, z), fittings)
    }
    for (const x of [-.49, 1.56]) {
      tube([v(x, .085, -1.22), v(x, .36, -1.17), v(x, .77, -.91), v(x, .88, -.68), v(x, .9, 0), v(x, .88, .68), v(x, .77, .91), v(x, .36, 1.17), v(x, .085, 1.22)], .04, aluminium, 64)
      for (const side of [-1, 1]) {
        const z = side * .76
        add(new THREE.BoxGeometry(.16, .09, .14).translate(x, .87, z), fittings)
        bolt(v(x, .925, z), v(0, 1, 0), .022)
        // Small collar at the rail/strut junction; not a swollen weld blob.
        add(new THREE.CylinderGeometry(.055, .055, .11, 16).rotateZ(Math.PI / 2).translate(x, .065, side * 1.22), fittings)
      }
    }
  }

  // Replace the coarse loop-like aerial with slender, tapered roof whips.
  const oldAerial = airframe.getObjectByName('antenna')
  if (oldAerial instanceof THREE.Mesh) {
    oldAerial.visible = false
    for (const [base, tip] of [
      [v(1.91, 2.65, 0), v(1.79, 3.17, 0)],
      [v(-3.34, 2.43, 0), v(-3.45, 2.84, 0)],
    ]) {
      const direction = tip.clone().sub(base)
      const rod = new THREE.CylinderGeometry(.004, .013, direction.length(), 12)
      rod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), direction.clone().normalize()))
      const centre = base.clone().lerp(tip, .5)
      add(rod.translate(centre.x, centre.y, centre.z), rubber)
      add(new THREE.CylinderGeometry(.032, .038, .045, 16).translate(base.x, base.y, base.z), fittings)
    }
  }

  // A dark rear bulkhead gives glazing real cabin depth rather than allowing
  // mountain scenery to shine straight through every window as a hollow shell.
  // Keep the accepted bulkhead's station, thickness and upper width, but
  // taper the lower corners inside the source's curved rear belly.
  const profile = new THREE.Shape()
  profile.moveTo(-.425, 1.125)
  for(const [z,y] of [[.425,1.125],[.585,1.275],[.625,1.35],[.625,2.175],[-.625,2.175],[-.625,1.35],[-.585,1.275]])profile.lineTo(z,y)
  profile.closePath()
  const bulkhead = new THREE.ExtrudeGeometry(profile, {depth:.055,bevelEnabled:false,steps:1,curveSegments:1})
  bulkhead.setIndex(Array.from({length:bulkhead.getAttribute('position').count},(_,i)=>i))
  bulkhead.rotateY(Math.PI/2).translate(-1.0175,0,0)
  airframe.updateMatrixWorld(true)
  const hull: THREE.Mesh[] = []
  airframe.traverse(o=>{if(o instanceof THREE.Mesh && /^(fuselage|reardoor_win[LR])$/.test(o.name))hull.push(o)})
  const inverse=airframe.matrixWorld.clone().invert(),ray=new THREE.Raycaster()
  let minimumClearance=Infinity,samples=0
  for(let yi=0;yi<=45;yi++) {
    const y=1.125+yi*.005
    const halfWidth=y<=1.275?THREE.MathUtils.lerp(.425,.585,(y-1.125)/.15):THREE.MathUtils.lerp(.585,.625,(y-1.275)/.075)
    for(let xi=0;xi<=11;xi++)for(const side of[-1,1]) {
      const x=-1.0175+xi*.005
      ray.set(v(x,y,side*2).applyMatrix4(airframe.matrixWorld),v(0,0,-side).transformDirection(airframe.matrixWorld))
      const hit=ray.intersectObjects(hull,false)[0]
      if(!hit)throw new Error('Rear bulkhead hull-clearance measurement unavailable')
      minimumClearance=Math.min(minimumClearance,side*hit.point.clone().applyMatrix4(inverse).z-halfWidth)
      samples++
    }
  }
  if(minimumClearance<.018)throw new Error('Rear bulkhead lower taper protrudes through the measured fuselage')
  details.userData.rearBulkheadQA={lowerCornersInset:true,minimumClearanceMetres:minimumClearance,samples,bothHullSidesVerified:true,sourceHullAndRotorGeometryUnchanged:true}
  add(bulkhead, rubber)
  // Subtle, rounded instrument binnacle behind the existing coaming.
  add(new THREE.BoxGeometry(.12, .25, 1.02).translate(2.18, 1.53, 0), rubber)

  for (const [material, geometries] of pieces) {
    const merged = mergeGeometries(geometries, false)
    geometries.forEach(geometry => geometry.dispose())
    if (!merged) throw new Error('Airframe detail geometry could not merge')
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = true; mesh.receiveShadow = true
    details.add(mesh)
  }
  airframe.add(details)
}
