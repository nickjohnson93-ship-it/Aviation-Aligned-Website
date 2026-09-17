/** Source-contour intake depth for the supplied EC135-class airframe.
 * The two original engine-cap boundary rings define every mouth coordinate.
 * The original shoulder baffle is retained in shape and opened at those rings;
 * no larger invented elliptical intakes, cowling move or rotor change is made.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const DEPTH = .10
const LIP_RADIUS = .008
const WELD_TOLERANCE = .00001
type Edge = { a: number; b: number; count: number }

function rotorProtected(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (ancestor.name === 'MainRotor_RIG' || ancestor.name === 'TailRotor_RIG') return true
  }
  return false
}

function sourceContours(mesh: THREE.Mesh, toAirframe: THREE.Matrix4) {
  const source = mesh.geometry, position = source.getAttribute('position'), index = source.index
  const points: THREE.Vector3[] = [], remap: number[] = [], spatial = new Map<string, number>()
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(toAirframe)
    if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error('Engine contour contains a non-finite position')
    const key = [point.x, point.y, point.z].map(value => Math.round(value / WELD_TOLERANCE)).join(',')
    let id = spatial.get(key)
    if (id === undefined) { id = points.length; points.push(point); spatial.set(key, id) }
    remap.push(id)
  }
  const edges = new Map<string, Edge>(), seenFaces = new Set<string>()
  const count = index?.count ?? position.count
  for (let i = 0; i < count; i += 3) {
    const face = [0, 1, 2].map(offset => remap[index ? index.getX(i + offset) : i + offset])
    if (new Set(face).size < 3) continue
    const key = [...face].sort((a, b) => a - b).join(',')
    if (seenFaces.has(key)) continue
    seenFaces.add(key)
    for (let k = 0; k < 3; k++) {
      const a = face[k], b = face[(k + 1) % 3], edgeKey = `${Math.min(a, b)},${Math.max(a, b)}`
      const existing = edges.get(edgeKey)
      if (existing) existing.count++; else edges.set(edgeKey, { a, b, count: 1 })
    }
  }
  const neighbors = new Map<number, number[]>()
  for (const edge of edges.values()) {
    if (edge.count > 2) throw new Error('Engine contour is non-manifold')
    if (edge.count !== 1) continue
    for (const [a, b] of [[edge.a, edge.b], [edge.b, edge.a]]) {
      const list = neighbors.get(a) || []; list.push(b); neighbors.set(a, list)
    }
  }
  if ([...neighbors.values()].some(list => list.length !== 2)) throw new Error('Engine mouth boundary is not a closed loop')
  const visited = new Set<number>(), loops: THREE.Vector3[][] = []
  for (const start of neighbors.keys()) {
    if (visited.has(start)) continue
    const loop: THREE.Vector3[] = []
    let current = start, previous = -1
    do {
      if (visited.has(current)) throw new Error('Engine boundary loops overlap')
      visited.add(current); loop.push(points[current].clone())
      const next = neighbors.get(current)!.find(id => id !== previous)!
      previous = current; current = next
    } while (current !== start && loop.length <= points.length)
    if (current !== start || loop.length < 3) throw new Error('Engine contour could not close')
    loops.push(loop)
  }
  return loops
}

function centreOf(loop: THREE.Vector3[]) {
  return loop.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / loop.length)
}

function planeGeometry(contour: THREE.Vector3[], holes: THREE.Vector3[][], planeX: number) {
  const outline = contour.map(point => new THREE.Vector2(point.y, point.z))
  const apertures = holes.map(loop => loop.map(point => new THREE.Vector2(point.y, point.z)))
  const faces = THREE.ShapeUtils.triangulateShape(outline, apertures)
  const points = [outline, ...apertures].flat()
  const positions: number[] = [], normals: number[] = []
  for (const face of faces) {
    const tri = face.map(id => points[id])
    const signedArea = (tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) - (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x)
    if (Math.abs(signedArea) < 1e-12) continue
    if (signedArea < 0) [tri[1], tri[2]] = [tri[2], tri[1]]
    for (const point of tri) { positions.push(planeX, point.x, point.y); normals.push(1, 0, 0) }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return geometry
}

function throatWalls(loop: THREE.Vector3[]) {
  const centre = centreOf(loop), positions: number[] = [], normals: number[] = []
  const emit = (tri: THREE.Vector3[]) => {
    const midpoint = tri.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3)
    const inward = new THREE.Vector3(0, centre.y - midpoint.y, centre.z - midpoint.z)
    const faceNormal = tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]))
    if (faceNormal.dot(inward) < 0) [tri[1], tri[2]] = [tri[2], tri[1]]
    for (const point of tri) {
      const normal = new THREE.Vector3(0, centre.y - point.y, centre.z - point.z).normalize()
      positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z)
    }
  }
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length]
    const c = b.clone().add(new THREE.Vector3(-DEPTH, 0, 0)), d = a.clone().add(new THREE.Vector3(-DEPTH, 0, 0))
    emit([a, b, c]); emit([a, c, d])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return geometry
}

export function refineEngineIntakes(airframe: THREE.Object3D): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Engine_Intake_Production_Refinement'
  const original = airframe.getObjectByName('engine')
  if (!(original instanceof THREE.Mesh) || rotorProtected(original)) {
    throw new Error('Source stationary engine geometry is unavailable')
  }
  airframe.updateMatrixWorld(true)
  const transform = airframe.matrixWorld.clone().invert().multiply(original.matrixWorld)
  const loops = sourceContours(original, transform)
  // Source engine consists of two same-side cap contours and a third shoulder
  // baffle spanning the centreline. Preserve all three, with real openings.
  const mouths = loops.filter(loop => Math.min(...loop.map(p => p.z)) * Math.max(...loop.map(p => p.z)) > 0)
  const baffles = loops.filter(loop => !mouths.includes(loop))
  if (mouths.length !== 2 || baffles.length !== 1) throw new Error('Source does not contain two intake contours and one shoulder baffle')
  if (mouths.some(loop => Math.max(...loop.map(p => p.x)) - Math.min(...loop.map(p => p.x)) > .03)) {
    throw new Error('Intake rim is not aligned with the supplied airframe axis')
  }

  const paint = new THREE.MeshPhysicalMaterial({ name: 'Engine intake navy painted lip', color: '#0c2236', metalness: .12,
    roughness: .25, clearcoat: .4, clearcoatRoughness: .16, envMapIntensity: .95 })
  const wall = new THREE.MeshStandardMaterial({ name: 'Engine intake dark recessed walls', color: '#18232b', metalness: .08, roughness: .62 })
  const backing = new THREE.MeshStandardMaterial({ name: 'Engine intake matte throat and shoulder baffle', color: '#080e13', metalness: 0, roughness: .86 })
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry
    if (prepared !== geometry) geometry.dispose()
    prepared.deleteAttribute('uv')
    const list = batches.get(material) || []; list.push(prepared); batches.set(material, list)
  }

  for (const loop of mouths) {
    const lip = new THREE.CatmullRomCurve3(loop.map(point => point.clone().add(new THREE.Vector3(.001, 0, 0))), true, 'centripetal')
    add(new THREE.TubeGeometry(lip, 48, LIP_RADIUS, 8, true), paint)
    add(throatWalls(loop), wall)
    add(planeGeometry(loop, [], centreOf(loop).x - DEPTH), backing)
  }
  // The old filled shoulder plate would otherwise hide the newly recessed
  // tunnels. Triangulate its original outline with the exact source rim holes.
  add(planeGeometry(baffles[0], mouths, centreOf(baffles[0]).x), backing)

  let triangles = 0
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts, false)
    parts.forEach(part => part.dispose())
    if (!geometry) throw new Error('Engine intake detail geometry could not merge')
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = material.name; mesh.castShadow = true; mesh.receiveShadow = true
    group.add(mesh); triangles += geometry.getAttribute('position').count / 3
  }
  if (triangles >= 2000) throw new Error('Engine intake exceeds its detail budget')
  original.visible = false
  group.userData = { sourceContours: loops.length, intakeMouths: mouths.length,
    sourceMouthVertices: mouths.map(loop => loop.length), depth: DEPTH, lipRadius: LIP_RADIUS,
    detailTriangles: triangles, shoulderBaffleRetained: true, originalEngineNodeRetained: true,
    rotorSubtreesUntouched: true, sourceDerivedMouths: true }
  return group
}
