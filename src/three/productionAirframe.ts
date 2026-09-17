/** Reference-led refinement of the supplied GPL-2.0 EC135 mesh.
 * Paint boundaries are actual material geometry, not non-exportable shaders.
 * No changes are permitted beneath either rotor rig.
 */
import * as THREE from 'three'
import { refineGlazing } from './glazingRefinement.ts'
import { refineCockpit } from './cockpitRefinement.ts'
import { refinePanelDetails } from './panelRefinement.ts'
import { refineEngineIntakes } from './intakeRefinement.ts'
import { addAircraftBrand } from './aircraftBrand.ts'
import { refineLowerFuselage } from './fuselageRefinement.ts'

type Vertex = { p: THREE.Vector3; n: THREE.Vector3; uv: THREE.Vector2 }
type Field = (p: THREE.Vector3) => number

export function isProtectedRotor(object: THREE.Object3D) {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (o.name === 'MainRotor_RIG' || o.name === 'TailRotor_RIG') return true
  }
  return false
}

// Measured visual placement, not a certified aircraft paint drawing. Smooth
// interpolation follows the visible aft-cabin sweep, rather than a height fade.
const stripeKnots = [[-2.3, 1.62], [-1.42, 2.05], [-.82, 2.03], [-.2, 1.83],
  [.6, 1.64], [1.5, 1.48], [2.4, 1.38], [3.25, 1.48]]
function stripeHeight(x: number) {
  if (x < stripeKnots[0][0]) return THREE.MathUtils.lerp(1.88, 1.62, THREE.MathUtils.clamp((x + 7) / 4.7, 0, 1))
  for (let i = 0; i < stripeKnots.length - 1; i++) {
    const [a, b] = [stripeKnots[i], stripeKnots[i + 1]]
    if (x > b[0]) continue
    const t = THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1)
    const prev = stripeKnots[Math.max(0, i - 1)], next = stripeKnots[Math.min(stripeKnots.length - 1, i + 2)]
    const ma = (b[1] - prev[1]) / (b[0] - prev[0]), mb = (next[1] - a[1]) / (next[0] - a[0])
    return (2*t*t*t - 3*t*t + 1)*a[1] + (t*t*t - 2*t*t + t)*(b[0]-a[0])*ma
      + (-2*t*t*t + 3*t*t)*b[1] + (t*t*t - t*t)*(b[0]-a[0])*mb
  }
  return stripeKnots[stripeKnots.length - 1][1]
}

function mixVertex(a: Vertex, b: Vertex, t: number): Vertex {
  return { p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), uv: a.uv.clone().lerp(b.uv, t) }
}

// Polygon clipping interpolates UVs/normals along original triangles. The new
// hard paint edge has no coplanar overlay and cannot z-fight.
function clip(poly: Vertex[], field: Field, positive: boolean) {
  const out: Vertex[] = []
  if (!poly.length) return out
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const fa = field(a.p), fb = field(b.p), ia = positive ? fa >= 0 : fa <= 0, ib = positive ? fb >= 0 : fb <= 0
    if (ia) out.push(a)
    if (ia !== ib) {
      let low = 0, high = 1
      for (let j = 0; j < 24; j++) {
        const t = (low + high) / 2, ft = field(a.p.clone().lerp(b.p, t))
        if ((ft >= 0) === (fa >= 0)) low = t; else high = t
      }
      out.push(mixVertex(a, b, (low + high) / 2))
    }
  }
  return out
}

function paintGeometry(source: THREE.BufferGeometry, localToAirframe: THREE.Matrix4) {
  const position = source.getAttribute('position'), normal = source.getAttribute('normal'), uv = source.getAttribute('uv')
  const inverse = localToAirframe.clone().invert(), normalToAirframe = new THREE.Matrix3().getNormalMatrix(localToAirframe)
  const normalToLocal = new THREE.Matrix3().getNormalMatrix(inverse)
  const buckets: Vertex[][][] = [[], [], []] // navy, silver, champagne
  const bodyBoundary: Field = p => p.y - stripeHeight(p.x)
  const width = .052
  const goldFields: [Field, number][] = [
    [bodyBoundary, width],
    // The reference's narrow duct surround and diagonal fin accent. These are
    // clipped onto the existing housing, not an invented replacement duct.
    [p => Math.hypot(p.x + 5.840155, p.y - 2.548362) - .625, .032],
    [p => p.y - (3.55 - .74 * (p.x + 5.85)), .065],
  ]
  const emit = (poly: Vertex[], bucket: number) => {
    for (let i = 1; i < poly.length - 1; i++) {
      const tri = [poly[0], poly[i], poly[i + 1]]
      if (tri[1].p.clone().sub(tri[0].p).cross(tri[2].p.clone().sub(tri[0].p)).lengthSq() > 1e-16) buckets[bucket].push(tri)
    }
  }
  const paint = (tri: Vertex[], depth = 0) => {
    const xs = tri.map(v => v.p.x), ys = tri.map(v => v.p.y)
    const nearBody = Math.max(...xs) > -2.3 && Math.min(...ys) < 2.2 && Math.max(...ys) > 1.3
    const nearTail = Math.min(...xs) < -5.2
    const lengths = [0, 1, 2].map(i => tri[i].p.distanceToSquared(tri[(i + 1) % 3].p))
    const edge = lengths.indexOf(Math.max(...lengths))
    if ((nearBody || nearTail) && lengths[edge] > .22*.22 && depth < 5) {
      const a = tri[edge], b = tri[(edge + 1) % 3], c = tri[(edge + 2) % 3], m = mixVertex(a, b, .5)
      paint([a, m, c], depth + 1); paint([m, b, c], depth + 1); return
    }
    let remainder: Vertex[][] = [tri]
    for (let f = 0; f < goldFields.length; f++) {
      // Keep the side stripe off the navy tail boom. Restrict fin graphic to
      // upper vertical stabiliser, and duct ring to the existing tail housing.
      const centre = tri.reduce((sum, v) => sum.add(v.p), new THREE.Vector3()).multiplyScalar(1/3)
      if (f === 0 && centre.x < -2.3) continue
      if (f === 1 && (centre.x > -5.05 || centre.x < -6.55 || centre.y < 1.75 || centre.y > 3.32 || Math.abs(centre.z) < .07)) continue
      if (f === 2 && (centre.x > -5.35 || centre.y < 3.35)) continue
      const [field, bandWidth] = goldFields[f], upper: Field = p => field(p) - bandWidth
      const next: Vertex[][] = []
      for (const poly of remainder) {
        emit(clip(clip(poly, field, true), upper, false), 2)
        const low = clip(poly, field, false), high = clip(poly, upper, true)
        if (low.length > 2) next.push(low)
        if (high.length > 2) next.push(high)
      }
      remainder = next
    }
    for (const poly of remainder) { emit(clip(poly, bodyBoundary, true), 0); emit(clip(poly, bodyBoundary, false), 1) }
  }
  const count = source.index?.count ?? position.count
  for (let i = 0; i < count; i += 3) {
    paint([0, 1, 2].map(k => {
      const id = source.index ? source.index.getX(i + k) : i + k
      return { p: new THREE.Vector3().fromBufferAttribute(position, id).applyMatrix4(localToAirframe),
        n: new THREE.Vector3().fromBufferAttribute(normal, id).applyMatrix3(normalToAirframe).normalize(),
        uv: uv ? new THREE.Vector2(uv.getX(id), uv.getY(id)) : new THREE.Vector2() }
    }))
  }
  const p: number[] = [], n: number[] = [], u: number[] = []
  const result = new THREE.BufferGeometry()
  buckets.forEach((triangles, slot) => {
    const start = p.length / 3
    for (const tri of triangles) for (const v of tri) {
      const point = v.p.clone().applyMatrix4(inverse), norm = v.n.clone().applyMatrix3(normalToLocal).normalize()
      p.push(point.x, point.y, point.z); n.push(norm.x, norm.y, norm.z); u.push(v.uv.x, v.uv.y)
    }
    if (triangles.length) result.addGroup(start, triangles.length * 3, slot)
  })
  result.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  result.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3))
  result.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2))
  result.computeBoundingBox(); result.computeBoundingSphere()
  return result
}

function discardCollapsedFaces(mesh: THREE.Mesh, replaced: THREE.BufferGeometry[]) {
  const source = mesh.geometry, p = source.getAttribute('position'), sourceIndex = source.index
  const count = sourceIndex?.count ?? p.count
  const groups = source.groups.length ? source.groups : [{ start: 0, count, materialIndex: 0 }]
  const index: number[] = [], keptGroups: {start:number; count:number; materialIndex:number}[] = []
  let removed = 0
  for (const group of groups) {
    const start = index.length
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const ids = [0,1,2].map(k => sourceIndex ? sourceIndex.getX(i+k) : i+k)
      const [a,b,c] = ids.map(id => new THREE.Vector3().fromBufferAttribute(p,id))
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-16) { removed++; continue }
      index.push(...ids)
    }
    if (index.length > start) keptGroups.push({start, count:index.length-start, materialIndex:group.materialIndex ?? 0})
  }
  if (removed) {
    replaced.push(source)
    mesh.geometry = source.clone()
    mesh.geometry.setIndex(index); mesh.geometry.clearGroups()
    keptGroups.forEach(g => mesh.geometry.addGroup(g.start,g.count,g.materialIndex))
  }
  return removed
}

export function refineProductionAirframe(airframe: THREE.Object3D, replaced: THREE.BufferGeometry[]) {
  if (airframe.userData.productionRefinement === 6) return
  airframe.updateMatrixWorld(true)
  refineLowerFuselage(airframe)
  // These additions use the untouched source boundary topology, before the
  // existing native navy/silver/gold paint splits its triangles.
  airframe.add(refinePanelDetails(airframe))
  airframe.add(refineEngineIntakes(airframe))
  airframe.add(addAircraftBrand(airframe))
  const inverse = airframe.matrixWorld.clone().invert()
  const graphite = new THREE.MeshPhysicalMaterial({ name: 'Graphite painted skid metal', color: '#222c34', metalness: .42, roughness: .35, clearcoat: .2, clearcoatRoughness: .22 })
  const seal = new THREE.MeshStandardMaterial({ name: 'Continuous aviation EPDM window gasket', color: '#10181e', metalness: 0, roughness: .76 })
  let skinTriangles = 0, skinParts = 0
  airframe.traverse(object => {
    if (!(object instanceof THREE.Mesh) || isProtectedRotor(object)) return
    const original = Array.isArray(object.material) ? object.material[0] : object.material
    if (/Deep navy enamel/.test(original.name) && !/antenna|wirecutter|frontlight/.test(object.name)) {
      const source = original as THREE.MeshPhysicalMaterial
      const make = (name: string, color: string, metalness: number, roughness: number) => {
        const m = new THREE.MeshPhysicalMaterial({ name, color, metalness, roughness, clearcoat: .58, clearcoatRoughness: .14,
          normalMap: source.normalMap, normalScale: new THREE.Vector2(.09, -.09), side: THREE.DoubleSide, envMapIntensity: 1.05 })
        m.userData.gltfSourceMaterialIndex = source.userData.gltfMaterialIndex
        return m
      }
      const materials = [make('Reference deep navy enamel', '#0c2236', .22, .24),
        make('Reference satin metallic silver lower fuselage', '#939c9f', .65, .32),
        make('Reference champagne gold metallic accent', '#b89e68', .72, .3)]
      const transform = inverse.clone().multiply(object.matrixWorld)
      replaced.push(object.geometry)
      object.geometry = paintGeometry(object.geometry, transform)
      object.material = materials
      object.userData.refinedPaint = 'navy / hard-edge silver / champagne'
      skinParts++; skinTriangles += object.geometry.getAttribute('position').count / 3
    } else if (/glazing/i.test(original.name)) {
      const m = (original as THREE.MeshPhysicalMaterial).clone()
      const cockpit = /windscreen|frontdoor|^glas$/.test(object.name)
      m.name = cockpit ? 'Curved smoked cockpit glazing' : 'Smoked cabin glazing'
      // Alpha glazing is intentional: WebGL transmission cannot refract the
      // CSS terrain behind the transparent canvas. No fake mirror chrome.
      m.color.set(cockpit ? '#334c5c' : '#273e4c')
      m.opacity = cockpit ? .78 : .86
      m.transparent = true; m.depthWrite = false; m.side = THREE.FrontSide
      m.metalness = 0; m.roughness = cockpit ? .075 : .095
      m.transmission = 0; m.ior = 1.46; m.thickness = .003
      m.clearcoat = 1; m.clearcoatRoughness = .075; m.envMapIntensity = 1.15
      object.material = m
    } else if (object.name === 'frontlight') {
      object.material = new THREE.MeshPhysicalMaterial({ name: 'Landing-light lens / unlit daytime reflector', color: '#a7b5bc',
        metalness: .35, roughness: .17, clearcoat: 1, clearcoatRoughness: .08, side: THREE.FrontSide })
    } else if (object.name === 'engine') {
      const m = (original as THREE.MeshStandardMaterial).clone()
      m.name = 'Dark engine ventilation surfaces'
      m.color.set('#18222a'); m.roughness = .64; m.metalness = .15
      object.material = m
    } else if (/handle|standardstep/.test(object.name)) {
      const m = (original as THREE.MeshStandardMaterial).clone()
      m.name = 'Painted graphite boarding step / latch'
      m.color.set('#38434b'); m.metalness = .5; m.roughness = .36
      object.material = m
    } else if (/exhaust/.test(object.name)) {
      const m = (original as THREE.MeshStandardMaterial).clone()
      m.name = 'Heat-resistant satin exhaust metal'
      m.color.set('#51585c'); m.metalness = .75; m.roughness = .43
      object.material = m
    } else if (/^Cylinder/.test(object.name)) {
      const m = (original as THREE.MeshPhysicalMaterial).clone()
      m.name = 'Satin stationary mast-base titanium'
      m.metalness = .8; m.roughness = .4; m.clearcoat = 0
      object.material = m
    }
  })
  const oldDetails = airframe.getObjectByName('Airframe_Refinement_Details')
  oldDetails?.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const m = Array.isArray(object.material) ? object.material[0] : object.material
    // Old geometry is retained; the reference specifies painted dark skids.
    if (m.name === 'Refined skid aluminium') object.material = graphite
  })
  airframe.add(refineGlazing(airframe, seal, replaced))
  airframe.add(refineCockpit(airframe))
  let collapsedFacesRemoved = 0
  airframe.traverse(object => {
    if (object instanceof THREE.Mesh && object.visible && !isProtectedRotor(object)) collapsedFacesRemoved += discardCollapsedFaces(object, replaced)
  })
  airframe.userData.productionRefinement = 6
  airframe.userData.productionQA = { skinParts, skinTriangles, collapsedFacesRemoved, rotorsExcluded: true, paintBoundary: 'geometry material slots, existing UVs interpolated' }
}
