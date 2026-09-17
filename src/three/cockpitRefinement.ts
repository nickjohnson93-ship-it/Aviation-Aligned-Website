/** Restrained cabin silhouettes for the supplied EC135-class asset.
 * Uses the original seat stations and measured glazing clearance. Interior
 * references are unavailable, so this is not a manufacturer cockpit replica.
 * Existing source nodes are retained; no rotor, pivot or exterior is touched.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { InteriorFloorQA, LowerFuselageQA } from './fuselageRefinement.ts'

const vector = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** The original rectangular floor reaches outside the tapered front belly.
 * Retain that source node/buffer and replace only its interior footprint. Its
 * 90 mm vertical depth, elevation and original untextured material stay intact.
 */
function insetCabinFloor(airframe: THREE.Object3D, result: THREE.Group) {
  const clearance = .018
  const qa: InteriorFloorQA = {
    refinementVersion: 1, matchedOriginalPart: false,
    sourceNodeAndGeometryRetained: true, originalFloorMaterialPreserved: true,
    floorTopBottomUnchanged: true, verifiedBothHullSides: false,
    clearanceTargetMetres: clearance,
  }
  const record = () => {
    result.userData.floorRefinement = qa
    airframe.userData.cockpitFloorQA = qa
    const lower = airframe.userData.lowerFuselageQA as LowerFuselageQA | undefined
    if (lower) lower.interiorFloor = qa
  }
  const floor = airframe.getObjectByName('Cabin_floor') || airframe.getObjectByName('Cabin floor')
  if (!(floor instanceof THREE.Mesh)) {
    qa.skippedReason = 'Verified source Cabin_floor mesh unavailable'
    record(); return
  }
  airframe.updateMatrixWorld(true)
  const inverse = airframe.matrixWorld.clone().invert()
  const transform = inverse.clone().multiply(floor.matrixWorld)
  const sourcePosition = floor.geometry.getAttribute('position')
  if (!sourcePosition) { qa.skippedReason = 'Source floor has no position attribute'; record(); return }
  const bounds = new THREE.Box3()
  for (let i = 0; i < sourcePosition.count; i++) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(sourcePosition, i).applyMatrix4(transform))
  const measured = [...bounds.min.toArray(), ...bounds.max.toArray()]
  const expected = [-1.25, 1.055, -.675, 2.45, 1.145, .675]
  if (!measured.every((value, axis) => Number.isFinite(value) && Math.abs(value - expected[axis]) < .015)) {
    qa.skippedReason = 'Cabin_floor name found but six measured source bounds do not match'
    record(); return
  }
  qa.sourceNode = floor.name
  qa.sourceBounds = { min: bounds.min.toArray(), max: bounds.max.toArray() }
  qa.sourceTriangles = (floor.geometry.index?.count ?? sourcePosition.count) / 3
  const hull: THREE.Mesh[] = []
  airframe.traverse(object => {
    const name = object.name.replace(/[.\s_]/g, '').toLowerCase()
    if (object instanceof THREE.Mesh && object.visible &&
      /^(fuselage|reardoorwin[lr]|frontdoor[lr]|backdoor[lr])\d*$/.test(name)) hull.push(object)
  })
  const ray = new THREE.Raycaster()
  const directionPositive = vector(0, 0, -1).transformDirection(airframe.matrixWorld)
  const directionNegative = directionPositive.clone().negate()
  let crossSections = 0
  const sideLimits = (x: number, y: number): [number, number] | undefined => {
    crossSections++
    ray.set(vector(x, y, 2).applyMatrix4(airframe.matrixWorld), directionPositive)
    const positive = ray.intersectObjects(hull, false)[0]
    ray.set(vector(x, y, -2).applyMatrix4(airframe.matrixWorld), directionNegative)
    const negative = ray.intersectObjects(hull, false)[0]
    if (!positive || !negative) return undefined
    const p = positive.point.clone().applyMatrix4(inverse).z
    const n = negative.point.clone().applyMatrix4(inverse).z
    return Number.isFinite(p) && Number.isFinite(n) && p > 0 && n < 0 ? [p, n] : undefined
  }
  const heights = Array.from({ length: 9 }, (_, i) => THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, i / 8))
  // The old aft end also extends beyond the rounded rear belly. Locate the
  // first fully enclosed station, then inset it by another 10 mm.
  let aft: number | undefined
  for (let x = bounds.min.x; x < bounds.max.x; x += .01) {
    const limits = heights.map(y => sideLimits(x, y))
    if (limits.every(value => value && value[0] > clearance + .04 && value[1] < -clearance - .04)) { aft = x + .01; break }
  }
  if (aft === undefined) { qa.skippedReason = 'No enclosed source-floor cross-section found'; record(); return }
  const taperStations = (start: number, end: number) => {
    if (end - start < .000001) return [start]
    const count = Math.ceil((end - start) / .12)
    return Array.from({ length: count + 1 }, (_, i) => THREE.MathUtils.lerp(start, end, i / count))
  }
  // The measured central belly is straight enough to share one floor span.
  // Dense ray verification still covers it; only the concealed mesh budget
  // changes, not the fit tolerance or the curved fore/aft station spacing.
  const middleStart = THREE.MathUtils.clamp(-.35, aft, bounds.max.x)
  const middleEnd = THREE.MathUtils.clamp(1.5, middleStart, bounds.max.x)
  const stations = [...taperStations(aft, middleStart), ...(middleEnd > middleStart ? [middleEnd] : []),
    ...taperStations(middleEnd, bounds.max.x).slice(1)]
  const segments = stations.length - 1
  const intervalLimits: [number, number][] = []
  for (let i = 0; i < segments; i++) {
    let positive = bounds.max.z, negative = bounds.min.z
    const samples = Math.ceil((stations[i + 1] - stations[i]) / .008)
    for (let sample = 0; sample <= samples; sample++) for (const y of heights) {
      const limits = sideLimits(THREE.MathUtils.lerp(stations[i], stations[i + 1], sample / samples), y)
      if (!limits) { qa.skippedReason = 'Floor interval is not enclosed by both source hull sides'; record(); return }
      positive = Math.min(positive, limits[0]); negative = Math.max(negative, limits[1])
    }
    intervalLimits.push([positive - clearance, negative + clearance])
  }
  // Each edge station is constrained by BOTH adjoining intervals, so linear
  // taper cannot interpolate out through a concave patch of the real belly.
  const edges = stations.map((x, i) => {
    const adjacent = intervalLimits.slice(Math.max(0, i - 1), Math.min(segments, i + 1))
    return { x, positive: Math.min(...adjacent.map(v => v[0])), negative: Math.max(...adjacent.map(v => v[1])) }
  })
  let minimumClearance = Infinity
  for (let i = 0; i < segments; i++) {
    const samples = Math.ceil((stations[i + 1] - stations[i]) / .008)
    for (let sample = 0; sample <= samples; sample++) for (const y of heights) {
      const t = sample / samples, x = THREE.MathUtils.lerp(stations[i], stations[i + 1], t)
      const limits = sideLimits(x, y)!
      minimumClearance = Math.min(minimumClearance,
        limits[0] - THREE.MathUtils.lerp(edges[i].positive, edges[i + 1].positive, t),
        THREE.MathUtils.lerp(edges[i].negative, edges[i + 1].negative, t) - limits[1])
    }
  }
  if (!Number.isFinite(minimumClearance) || minimumClearance < clearance - .0001) {
    qa.skippedReason = 'Inset floor failed the dense both-sided hull-clearance check'; record(); return
  }
  const positions: number[] = [], uvs: number[] = []
  const emit = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z)
      uvs.push((p.x - bounds.min.x) / (bounds.max.x - bounds.min.x), (p.z - bounds.min.z) / (bounds.max.z - bounds.min.z))
    }
  }
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => { emit(a, b, c); emit(a, c, d) }
  const corners = edges.map(edge => ({
    bl: vector(edge.x, bounds.min.y, edge.negative), br: vector(edge.x, bounds.min.y, edge.positive),
    tl: vector(edge.x, bounds.max.y, edge.negative), tr: vector(edge.x, bounds.max.y, edge.positive),
  }))
  for (let i = 0; i < segments; i++) {
    const a = corners[i], b = corners[i + 1]
    quad(a.tl, a.tr, b.tr, b.tl); quad(a.bl, b.bl, b.br, a.br)
    quad(a.br, b.br, b.tr, a.tr); quad(a.bl, a.tl, b.tl, b.bl)
  }
  const first = corners[0], last = corners[segments]
  quad(first.bl, first.br, first.tr, first.tl); quad(last.bl, last.tl, last.tr, last.br)
  const geometry = floor.geometry.clone()
  geometry.setIndex(null); geometry.clearGroups()
  for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name)
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  const replacement = new THREE.Mesh(geometry, floor.material)
  replacement.name = 'Cabin_floor_inset_to_measured_belly'
  replacement.castShadow = true; replacement.receiveShadow = true
  result.add(replacement)
  floor.visible = false
  qa.matchedOriginalPart = true
  qa.insetBounds = { min: geometry.boundingBox!.min.toArray(), max: geometry.boundingBox!.max.toArray() }
  qa.replacementTriangles = positions.length / 9
  qa.verifiedBothHullSides = true
  qa.minimumMeasuredClearanceMetres = minimumClearance
  qa.hullCrossSectionSamples = crossSections
  record()
}

export function refineCockpit(airframe: THREE.Object3D): THREE.Group {
  const result = new THREE.Group()
  result.name = 'Cockpit_Production_Refinement'
  insetCabinFloor(airframe, result)
  const upholstery = new THREE.MeshStandardMaterial({ color: '#24292e', roughness: .76, metalness: 0 })
  upholstery.name = 'Cabin charcoal upholstery'
  const trim = new THREE.MeshStandardMaterial({ color: '#0c1218', roughness: .62, metalness: 0 })
  trim.name = 'Cockpit matte graphite trim'
  const hardware = new THREE.MeshStandardMaterial({ color: '#656d73', roughness: .46, metalness: .65 })
  hardware.name = 'Cabin satin metal fittings'
  const screens = new THREE.MeshPhysicalMaterial({ color: '#12272c', roughness: .18, metalness: 0, clearcoat: .3, clearcoatRoughness: .16 })
  screens.name = 'Cockpit unlabelled dark display glass'
  const indicators = new THREE.MeshStandardMaterial({ color: '#698280', emissive: '#263b36', emissiveIntensity: .08, roughness: .64, metalness: 0 })
  indicators.name = 'Cockpit restrained instrument marks'

  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    // Unify indexed/non-indexed source geometries before merging by material.
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry
    if (prepared !== geometry) geometry.dispose()
    const list = batches.get(material) || []
    list.push(prepared)
    batches.set(material, list)
  }
  const box = (size: THREE.Vector3, centre: THREE.Vector3, material: THREE.Material, radius = .025, segments = 1, recline = 0) => {
    const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, segments, radius)
    geometry.rotateZ(recline).translate(centre.x, centre.y, centre.z)
    add(geometry, material)
  }
  const block = (size: THREE.Vector3, centre: THREE.Vector3, material: THREE.Material, recline = 0) => {
    add(new THREE.BoxGeometry(size.x, size.y, size.z).rotateZ(recline).translate(centre.x, centre.y, centre.z), material)
  }
  const rod = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, radial = 8) => {
    const direction = b.clone().sub(a)
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), radial)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vector(0, 1, 0), direction.normalize()))
    const centre = a.clone().lerp(b, .5)
    add(geometry.translate(centre.x, centre.y, centre.z), material)
  }

  // The source exports box-shaped pads without applied bevels. Replacements
  // stay inside the source dimensions and leave the six seating stations intact.
  const sourceSeats: THREE.Mesh[] = []
  airframe.traverse(object => {
    // GLTFLoader sanitises spaces/dots in object names; accept both the raw
    // Blender names and their runtime form without renaming the source nodes.
    if (object instanceof THREE.Mesh && /^Cabin[ _]seat[ _](base|back)/.test(object.name)) sourceSeats.push(object)
  })
  for (const seat of sourceSeats) {
    seat.visible = false
    const centre = seat.position.clone()
    const pilot = centre.x > 1
    if (/seat[ _]base/.test(seat.name)) {
      box(vector(.49, .13, .44), centre, upholstery, .035, pilot ? 2 : 1)
      // A shallow metal seat pan rests above the retained cabin floor.
      block(vector(.37, .025, .34), centre.clone().add(vector(-.02, -.07, 0)), hardware)
    } else {
      const lean = .07
      box(vector(.15, .53, .43), centre, upholstery, .042, pilot ? 2 : 1, lean)
      // Narrow side bolsters, not inflated bucket-seat volumes.
      for (const side of [-1, 1]) {
        const bolsterCentre = centre.clone().add(vector(.055, -.02, side * .19))
        if (pilot) box(vector(.12, .43, .055), bolsterCentre, upholstery, .022, 1, lean)
        else block(vector(.08, .39, .04), bolsterCentre, upholstery, lean)
        rod(centre.clone().add(vector(-.024, .25, side * .075)), centre.clone().add(vector(-.03, .32, side * .075)), .009, hardware)
      }
      box(vector(.12, .15, .28), centre.clone().add(vector(-.027, .345, 0)), upholstery, .035)
    }
  }

  const coaming = airframe.getObjectByName('Instrument_coaming') || airframe.getObjectByName('Instrument coaming')
  if (coaming instanceof THREE.Mesh) {
    coaming.visible = false
    // Preserve the original coaming footprint; only round its hard box edges.
    box(vector(.43, .18, 1.20), coaming.position.clone(), trim, .045, 2)
  }

  // The earlier airframe pass already supplies a binnacle at x2.18/y1.53.
  // This centre pedestal ends at x2.105: no coincident replacement housing.
  box(vector(.43, .24, .17), vector(1.89, 1.30, 0), trim, .022)
  block(vector(.37, .012, .14), vector(1.89, 1.426, 0), hardware)
  for (const x of [1.78, 1.91, 2.015]) {
    add(new THREE.CylinderGeometry(.008, .008, .009, 8).translate(x, 1.437, 0), trim)
  }

  // Two subdued, unlabelled instrument apertures sit on the aft binnacle face.
  // No invented avionics branding, bright screen artwork or OEM layout claim.
  for (const side of [-1, 1]) {
    const z = side * .285
    box(vector(.018, .17, .25), vector(2.105, 1.535, z), trim, .012)
    add(new THREE.PlaneGeometry(.222, .139).rotateY(-Math.PI / 2).translate(2.094, 1.535, z), screens)
    for (const offset of [-.052, .018]) {
      add(new THREE.PlaneGeometry(.115, .0025).rotateY(-Math.PI / 2).translate(2.092, 1.535 + offset, z), indicators)
    }
    for (const offset of [-.076, 0, .076]) {
      rod(vector(2.090, 1.442, z + offset), vector(2.105, 1.442, z + offset), .006, hardware)
    }
  }

  // Simple dual cyclic silhouettes, kept between the source seat fronts and
  // panel. Their scale remains subordinate to the glazing and airframe.
  for (const side of [-1, 1]) {
    const z = side * .39
    rod(vector(2.005, 1.165, z), vector(2.005, 1.38, z), .011, hardware)
    rod(vector(2.005, 1.38, z), vector(1.972, 1.505, z), .011, hardware)
    rod(vector(1.972, 1.494, z), vector(1.961, 1.564, z), .018, trim, 10)
    block(vector(.052, .018, .045), vector(1.96, 1.561, z), trim)
  }

  let triangles = (result.userData.floorRefinement as InteriorFloorQA).replacementTriangles || 0
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false)
    geometries.forEach(piece => piece.dispose())
    if (!geometry) throw new Error('Cockpit detail geometry could not merge')
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = material.name
    mesh.castShadow = material !== screens && material !== indicators
    mesh.receiveShadow = true
    result.add(mesh)
    triangles += geometry.getAttribute('position').count / 3
  }
  result.userData.detailTriangles = triangles
  result.userData.originalSeatNodesRetained = sourceSeats.length
  result.userData.interiorReferenceLimited = true
  return result
}
