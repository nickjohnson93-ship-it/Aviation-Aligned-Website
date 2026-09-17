/**
 * Reference-supported fine door/cowling joins on the supplied EC135 source.
 * Uses existing outer panel topology, never a fabricated panel grid. Rotor
 * subtrees, original geometry, original hardware and UVs are untouched.
 * GPL-2.0; original EC135 mesh: Heiko Schulz / HHS81.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type SurfacePoint = { p: THREE.Vector3; n: THREE.Vector3 }
type PanelLoop = { points: SurfacePoint[]; projectedArea: number }
type LoopAudit = { panel: string; availableLoops: number; outerVertices: number; area: number; perimeter: number; flushFasteners: number }

const WELD = .00001
const HALF_GAP = .0018 // 3.6 mm total; not a rounded rubber bead.
const SURFACE_OFFSET = .0009
const FASTENER_RADIUS = .00275
const FASTENER_DEPTH = .0015
const FASTENER_PITCH = .108

function protectedRotor(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.name === 'MainRotor_RIG' || node.name === 'TailRotor_RIG') return true
  }
  return false
}

/** Closed manifold border components only. Window/handle holes stay separate. */
function closedPanelLoops(mesh: THREE.Mesh, localToAirframe: THREE.Matrix4): PanelLoop[] {
  const position = mesh.geometry.getAttribute('position')
  const normal = mesh.geometry.getAttribute('normal')
  if (!position || !normal) return []
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(localToAirframe)
  const points: SurfacePoint[] = [], ids: number[] = []
  const welded = new Map<string, number>()
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(localToAirframe)
    const n = new THREE.Vector3().fromBufferAttribute(normal, i).applyMatrix3(normalMatrix)
    const key = [p.x, p.y, p.z].map(value => Math.round(value / WELD)).join(',')
    let id = welded.get(key)
    if (id === undefined) { id = points.length; welded.set(key, id); points.push({ p, n }) }
    else points[id].n.add(n)
    ids.push(id)
  }
  points.forEach(point => point.n.normalize())
  const edges = new Map<string, { a: number; b: number; count: number }>()
  const faces = new Set<string>()
  const index = mesh.geometry.index
  const count = index?.count ?? position.count
  for (let i = 0; i + 2 < count; i += 3) {
    const tri = [0, 1, 2].map(k => ids[index ? index.getX(i + k) : i + k])
    if (new Set(tri).size < 3) continue
    const [a, b, c] = tri.map(id => points[id].p)
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-16) continue
    const faceKey = [...tri].sort((a, b) => a - b).join(',')
    if (faces.has(faceKey)) continue
    faces.add(faceKey)
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3]
      const key = a < b ? `${a},${b}` : `${b},${a}`
      const edge = edges.get(key)
      if (edge) edge.count++
      else edges.set(key, { a, b, count: 1 })
    }
  }
  const adjacency = new Map<number, number[]>()
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue
    for (const [a, b] of [[edge.a, edge.b], [edge.b, edge.a]]) {
      const list = adjacency.get(a) || []
      list.push(b); adjacency.set(a, list)
    }
  }
  const visited = new Set<number>(), loops: PanelLoop[] = []
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue
    // Reject a whole ambiguous/non-manifold component, not just its branches.
    const component: number[] = [], stack = [start]
    while (stack.length) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id); component.push(id)
      stack.push(...(adjacency.get(id) || []).filter(next => !visited.has(next)))
    }
    if (component.length < 6 || component.some(id => adjacency.get(id)?.length !== 2)) continue
    const ordered: number[] = []
    let previous = -1, current = start
    do {
      ordered.push(current)
      const next = adjacency.get(current)!.find(id => id !== previous)!
      previous = current; current = next
    } while (current !== start && ordered.length <= component.length)
    if (current !== start || ordered.length !== component.length) continue
    const loopPoints = ordered.map(id => points[id])
    const areaVector = new THREE.Vector3()
    loopPoints.forEach((point, i) => areaVector.add(point.p.clone().cross(loopPoints[(i + 1) % loopPoints.length].p)))
    const projectedArea = Math.max(Math.abs(areaVector.x), Math.abs(areaVector.y), Math.abs(areaVector.z)) * .5
    if (projectedArea > .015) loops.push({ points: loopPoints, projectedArea })
  }
  return loops.sort((a, b) => b.projectedArea - a.projectedArea)
}

/** Flat, bounded-miter strip follows source vertices exactly; no curve bulge. */
function gapRibbon(points: SurfacePoint[]) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = []
  points.forEach((point, i) => {
    const previous = points[(i + points.length - 1) % points.length].p
    const next = points[(i + 1) % points.length].p
    const incoming = point.p.clone().sub(previous).normalize()
    const outgoing = next.clone().sub(point.p).normalize()
    const tangent = incoming.clone().add(outgoing)
    if (tangent.lengthSq() < 1e-12) tangent.copy(outgoing)
    tangent.normalize()
    const lateral = point.n.clone().cross(tangent).normalize()
    const edgeLateral = point.n.clone().cross(outgoing).normalize()
    // Bound corner width below 4 mm; never form a swollen/spiky joint.
    const miter = Math.min(1.1, 1 / Math.max(1 / 1.1, Math.abs(lateral.dot(edgeLateral))))
    const center = point.p.clone().addScaledVector(point.n, SURFACE_OFFSET)
    for (const sign of [-1, 1]) {
      const vertex = center.clone().addScaledVector(lateral, sign * HALF_GAP * miter)
      positions.push(vertex.x, vertex.y, vertex.z)
      normals.push(point.n.x, point.n.y, point.n.z)
    }
  })
  for (let i = 0; i < points.length; i++) {
    const a = i * 2, b = ((i + 1) % points.length) * 2
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}

function perimeter(points: SurfacePoint[]) {
  return points.reduce((sum, point, i) => sum + point.p.distanceTo(points[(i + 1) % points.length].p), 0)
}

/** Quiet flush rivets on supported lower/aft skin, inset from the moving gap. */
function doorFasteners(points: SurfacePoint[], output: THREE.BufferGeometry[]) {
  const bounds = new THREE.Box3().setFromPoints(points.map(point => point.p))
  const size = bounds.getSize(new THREE.Vector3())
  const center = points.reduce((sum, point) => sum.add(point.p), new THREE.Vector3()).multiplyScalar(1 / points.length)
  const total = perimeter(points)
  const count = Math.floor(total / FASTENER_PITCH)
  let emitted = 0, edge = 0, accumulated = 0
  const lengths = points.map((point, i) => point.p.distanceTo(points[(i + 1) % points.length].p))
  for (let i = 0; i < count; i++) {
    const distance = (i + .5) * total / count
    while (edge < points.length - 1 && accumulated + lengths[edge] < distance) accumulated += lengths[edge++]
    const a = points[edge], b = points[(edge + 1) % points.length]
    const t = (distance - accumulated) / lengths[edge]
    const p = a.p.clone().lerp(b.p, t)
    // No all-around dotted outlines, no rivets around glazing cutouts or roof.
    const lowerSkin = p.y < bounds.min.y + size.y * .23
    const aftSkin = p.x < bounds.min.x + size.x * .10 && p.y < bounds.min.y + size.y * .77
    if (!lowerSkin && !aftSkin) continue
    const normal = a.n.clone().lerp(b.n, t).normalize()
    const tangent = b.p.clone().sub(a.p).normalize()
    const inset = normal.clone().cross(tangent).normalize()
    if (inset.dot(center.clone().sub(p)) < 0) inset.negate()
    p.addScaledVector(inset, .018)
    // Most of the head thickness is buried, so the exposed crown is <1 mm.
    p.addScaledVector(normal, .0002)
    const geometry = new THREE.CylinderGeometry(FASTENER_RADIUS, FASTENER_RADIUS, FASTENER_DEPTH, 8, 1)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal))
    geometry.translate(p.x, p.y, p.z)
    output.push(geometry); emitted++
  }
  return emitted
}

/** Returns an unattached group; call on source topology BEFORE livery clipping. */
export function refinePanelDetails(airframe: THREE.Object3D): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Aircraft_Panel_Refinement'
  const seams: THREE.BufferGeometry[] = [], fasteners: THREE.BufferGeometry[] = []
  const audit: LoopAudit[] = [], skipped: string[] = []
  airframe.updateMatrixWorld(true)
  const inverse = airframe.matrixWorld.clone().invert()
  airframe.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible || protectedRotor(object)) return
    // GLTFLoader sanitizes dots/spaces; accept both untouched and loaded names.
    const canonical = object.name.replace(/[.\s_]/g, '')
    const door = /^(backdoor|frontdoor)[LR]$/.test(canonical)
    const cowling = canonical.toLowerCase() === 'nonibf'
    if (!door && !cowling) return
    const loops = closedPanelLoops(object, inverse.clone().multiply(object.matrixWorld))
    const outer = loops[0]
    if (!outer || (door && outer.projectedArea < .25)) { skipped.push(object.name); return }
    // Only the single verified outer cowling contour, never its vent apertures.
    seams.push(gapRibbon(outer.points))
    const flushFasteners = door ? doorFasteners(outer.points, fasteners) : 0
    audit.push({ panel: object.name, availableLoops: loops.length, outerVertices: outer.points.length,
      area: outer.projectedArea, perimeter: perimeter(outer.points), flushFasteners })
  })
  const gap = new THREE.MeshStandardMaterial({ name: 'Fine recessed navy-gray panel joins', color: '#24303b', metalness: 0, roughness: .88, side: THREE.DoubleSide })
  const flushMetal = new THREE.MeshStandardMaterial({ name: 'Subtle flush aviation door fasteners', color: '#4a5660', metalness: .58, roughness: .42 })
  let triangles = 0
  for (const [pieces, material, name] of [
    [seams, gap, 'Source-topology door and cowling gap ribbons'],
    [fasteners, flushMetal, 'Flush lower and aft door fasteners'],
  ] as const) {
    if (!pieces.length) { material.dispose(); continue }
    const geometry = mergeGeometries(pieces, false)
    pieces.forEach(piece => piece.dispose())
    if (!geometry) throw new Error('Fine panel details could not merge')
    for (const name of ['position', 'normal']) {
      if (![...geometry.getAttribute(name).array].every(Number.isFinite)) throw new Error(`Non-finite panel ${name}`)
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true
    group.add(mesh)
  }
  if (triangles > 6000) throw new Error(`Panel detail triangle budget exceeded: ${triangles}`)
  group.userData.panelQA = {
    sourceTopologyOuterContoursOnly: true, noWindowHoleOutlines: true,
    originalGeometryUvsHardwareAndRotorsUnchanged: true,
    gapWidthMm: HALF_GAP * 2000, maximumCornerGapWidthMm: HALF_GAP * 2200,
    surfaceOffsetMm: SURFACE_OFFSET * 1000,
    fastenerRadiusMm: FASTENER_RADIUS * 1000, fastenerDepthMm: FASTENER_DEPTH * 1000,
    fastenerPlacement: 'Lower and aft outer door skin only; no decorative all-around zipper',
    hingePolicy: 'Existing modeled handles and hinge hardware preserved; no unverified hardware invented',
    drawCalls: group.children.length, triangles, panels: audit, skipped,
  }
  return group
}
