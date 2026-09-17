/** Refine the supplied glazing without touching either animated rotor hierarchy.
 * UVs, positions, indices and material assignments stay intact. Only the cloned
 * normal attribute and an independent, topology-derived gasket mesh are added.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const GROUP_NAME = 'Airframe_Refinement_Closed_Glazing'
const WELD_TOLERANCE = .00001
const SEAL_RADIUS = .006
const SEAL_OFFSET = .0025
const RADIAL_SEGMENTS = 6
const MAX_RING_COUNT = 480 // 5,760 triangles, irrespective of the pane count.

type OutlinePoint = { position: THREE.Vector3; normal: THREE.Vector3 }
type Edge = { a: number; b: number; count: number }

function protectedByRotor(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (/^(MainRotor_RIG|TailRotor_RIG)$/.test(ancestor.name)) return true
  }
  return false
}

function isGlazing(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials.some(material => /glazing/i.test(material.name)) ||
    /^(windscreen_tri|glas|(?:frontdoorglas|backdoorglas|rearwin)\.[LR])$/.test(mesh.name)
}

function distanceToSegmentSquared(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const direction = b.clone().sub(a)
  const lengthSquared = direction.lengthSq()
  const t = lengthSquared ? THREE.MathUtils.clamp(point.clone().sub(a).dot(direction) / lengthSquared, 0, 1) : 0
  return point.distanceToSquared(a.clone().addScaledVector(direction, t))
}

/** Douglas–Peucker on two open arcs avoids an arbitrary closed-loop seam. */
function simplifyLoop(loop: OutlinePoint[], tolerance: number) {
  if (loop.length < 5) return loop
  let split = 1
  for (let i = 2; i < loop.length; i++) {
    if (loop[i].position.distanceToSquared(loop[0].position) > loop[split].position.distanceToSquared(loop[0].position)) split = i
  }
  const simplifyArc = (arc: OutlinePoint[]): OutlinePoint[] => {
    if (arc.length <= 2) return arc
    let maximum = tolerance * tolerance, furthest = -1
    for (let i = 1; i < arc.length - 1; i++) {
      const distance = distanceToSegmentSquared(arc[i].position, arc[0].position, arc[arc.length - 1].position)
      if (distance > maximum) { maximum = distance; furthest = i }
    }
    if (furthest < 0) return [arc[0], arc[arc.length - 1]]
    return [...simplifyArc(arc.slice(0, furthest + 1)).slice(0, -1), ...simplifyArc(arc.slice(furthest))]
  }
  const first = simplifyArc(loop.slice(0, split + 1))
  const second = simplifyArc([...loop.slice(split), loop[0]])
  const result = [...first.slice(0, -1), ...second.slice(0, -1)]
  return result.length >= 3 ? result : [loop[0], loop[Math.floor(loop.length / 3)], loop[Math.floor(loop.length * 2 / 3)]]
}

/** A closed polygonal tube: no spline overshoot through window corners, and no
 * overlapping capped cylinders or open seam at the start/end of a gasket. */
function makeSeal(loop: OutlinePoint[]) {
  const positions: number[] = [], normals: number[] = [], indices: number[] = []
  loop.forEach((point, i) => {
    const previous = loop[(i + loop.length - 1) % loop.length].position
    const next = loop[(i + 1) % loop.length].position
    const incoming = point.position.clone().sub(previous).normalize()
    const outgoing = next.clone().sub(point.position).normalize()
    const tangent = incoming.add(outgoing)
    if (tangent.lengthSq() < 1e-12) tangent.copy(outgoing)
    tangent.normalize()
    const surfaceNormal = point.normal.clone().normalize()
    const radial = surfaceNormal.clone().addScaledVector(tangent, -surfaceNormal.dot(tangent))
    if (radial.lengthSq() < 1e-12) {
      radial.set(Math.abs(tangent.y) < .9 ? 0 : 1, Math.abs(tangent.y) < .9 ? 1 : 0, 0)
      radial.addScaledVector(tangent, -radial.dot(tangent))
    }
    radial.normalize()
    const binormal = tangent.clone().cross(radial).normalize()
    const centre = point.position.clone().addScaledVector(surfaceNormal, SEAL_OFFSET)
    // Tight source-pane corners must not fold a full-width gasket back through
    // itself. A small local bevel/taper retains the exact contour and joins.
    const radius = Math.min(SEAL_RADIUS, .28 * Math.min(point.position.distanceTo(previous), point.position.distanceTo(next)))
    for (let j = 0; j < RADIAL_SEGMENTS; j++) {
      const theta = j / RADIAL_SEGMENTS * Math.PI * 2
      const normal = radial.clone().multiplyScalar(Math.cos(theta)).addScaledVector(binormal, Math.sin(theta)).normalize()
      const position = centre.clone().addScaledVector(normal, radius)
      positions.push(position.x, position.y, position.z)
      normals.push(normal.x, normal.y, normal.z)
      const a = i * RADIAL_SEGMENTS + j
      const b = i * RADIAL_SEGMENTS + (j + 1) % RADIAL_SEGMENTS
      const c = ((i + 1) % loop.length) * RADIAL_SEGMENTS + j
      const d = ((i + 1) % loop.length) * RADIAL_SEGMENTS + (j + 1) % RADIAL_SEGMENTS
      indices.push(a, b, c, b, d, c)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}

export function refineGlazing(root: THREE.Object3D, sealMaterial: THREE.Material, replaced: THREE.BufferGeometry[]): THREE.Group {
  const existing = root.getObjectByName(GROUP_NAME)
  if (existing instanceof THREE.Group && existing.userData.glazingRefinementVersion === 1) return existing
  const group = new THREE.Group()
  group.name = GROUP_NAME
  const sourceMeshes: THREE.Mesh[] = []
  root.traverse(object => {
    if (object instanceof THREE.Mesh && !protectedByRotor(object) && isGlazing(object)) sourceMeshes.push(object)
  })
  root.updateMatrixWorld(true)
  const rootInverse = root.matrixWorld.clone().invert()
  const outlines: OutlinePoint[][] = []
  let invalidVertices = 0, invalidFaces = 0, nonManifoldEdges = 0, skippedComponents = 0, smoothedVertices = 0

  for (const mesh of sourceMeshes) {
    const original = mesh.geometry
    const position = original.getAttribute('position')
    if (!position) continue
    const oldNormal = original.getAttribute('normal')
    const ids: number[] = [], unique: THREE.Vector3[] = [], normalSums: THREE.Vector3[] = [], originalNormalSums: THREE.Vector3[] = []
    const spatial = new Map<string, number>()
    let finite = true
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i)
      if (![point.x, point.y, point.z].every(Number.isFinite)) { invalidVertices++; finite = false }
      const key = [point.x, point.y, point.z].map(value => Math.round(value / WELD_TOLERANCE)).join(',')
      let id = spatial.get(key)
      if (id === undefined) {
        id = unique.length; spatial.set(key, id); unique.push(point)
        normalSums.push(new THREE.Vector3()); originalNormalSums.push(new THREE.Vector3())
      }
      ids.push(id)
      if (oldNormal) originalNormalSums[id].add(new THREE.Vector3().fromBufferAttribute(oldNormal, i))
    }
    // Do not amplify invalid source data into a replacement mesh or outline.
    if (!finite) continue
    const index = original.index
    const count = index ? index.count : position.count
    const edges = new Map<string, Edge>(), triangles = new Set<string>()
    for (let i = 0; i + 2 < count; i += 3) {
      const face = [0, 1, 2].map(offset => ids[index ? index.getX(i + offset) : i + offset])
      if (face.some(id => id === undefined) || new Set(face).size < 3) { invalidFaces++; continue }
      const faceKey = [...face].sort((a, b) => a - b).join(',')
      if (triangles.has(faceKey)) continue
      const [a, b, c] = face.map(id => unique[id])
      const weightedNormal = b.clone().sub(a).cross(c.clone().sub(a))
      if (weightedNormal.lengthSq() < 1e-20) { invalidFaces++; continue }
      triangles.add(faceKey)
      face.forEach(id => normalSums[id].add(weightedNormal))
      for (let j = 0; j < 3; j++) {
        const a = face[j], b = face[(j + 1) % 3]
        const edgeKey = `${Math.min(a, b)},${Math.max(a, b)}`
        const edge = edges.get(edgeKey)
        if (edge) edge.count++; else edges.set(edgeKey, { a, b, count: 1 })
      }
    }
    normalSums.forEach((normal, id) => {
      if (normal.lengthSq() < 1e-16) normal.copy(originalNormalSums[id])
      if (normal.lengthSq() < 1e-16) normal.copy(unique[id]).sub(new THREE.Vector3(.55, 1.7, 0))
      if (normal.lengthSq() < 1e-16) normal.set(0, 1, 0)
      if (normal.dot(originalNormalSums[id]) < 0) normal.negate()
      normal.normalize()
    })
    const geometry = original.clone()
    const normals = new Float32Array(position.count * 3)
    ids.forEach((id, i) => normalSums[id].toArray(normals, i * 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    mesh.geometry = geometry; replaced.push(original); smoothedVertices += position.count

    const adjacent = new Map<number, number[]>()
    for (const edge of edges.values()) {
      if (edge.count > 2) nonManifoldEdges++
      if (edge.count !== 1) continue
      for (const [a, b] of [[edge.a, edge.b], [edge.b, edge.a]]) {
        const neighbors = adjacent.get(a) || []
        neighbors.push(b); adjacent.set(a, neighbors)
      }
    }
    const transform = rootInverse.clone().multiply(mesh.matrixWorld)
    const normalTransform = new THREE.Matrix3().getNormalMatrix(transform)
    const visited = new Set<number>()
    for (const start of adjacent.keys()) {
      if (visited.has(start)) continue
      const stack = [start], component: number[] = []
      while (stack.length) {
        const id = stack.pop()!
        if (visited.has(id)) continue
        visited.add(id); component.push(id)
        for (const neighbor of adjacent.get(id) || []) if (!visited.has(neighbor)) stack.push(neighbor)
      }
      if (component.length < 3 || component.some(id => adjacent.get(id)?.length !== 2)) { skippedComponents++; continue }
      const ordered = [start]
      let previous = start, next = adjacent.get(start)![0]
      while (next !== start && ordered.length <= component.length) {
        ordered.push(next)
        const following = adjacent.get(next)!.find(id => id !== previous)!
        previous = next; next = following
      }
      if (next !== start || ordered.length !== component.length) { skippedComponents++; continue }
      outlines.push(ordered.map(id => ({
        position: unique[id].clone().applyMatrix4(transform),
        normal: normalSums[id].clone().applyNormalMatrix(normalTransform),
      })))
    }
  }

  let contourTolerance = .0015
  let loops = outlines.map(loop => simplifyLoop(loop, contourTolerance))
  // The supplied asset fits comfortably; the bound also protects future inputs
  // from exploding a hero's draw budget while retaining every source pane.
  while (loops.reduce((sum, loop) => sum + loop.length, 0) > MAX_RING_COUNT && contourTolerance < .1) {
    contourTolerance *= 1.35
    loops = outlines.map(loop => simplifyLoop(loop, contourTolerance))
  }
  if (loops.reduce((sum, loop) => sum + loop.length, 0) > MAX_RING_COUNT) {
    throw new Error('Glazing outline exceeds the bounded detail budget')
  }
  const parts = loops.map(makeSeal)
  let sealTriangles = 0, sealVertices = 0
  if (parts.length) {
    const merged = mergeGeometries(parts, false)
    parts.forEach(geometry => geometry.dispose())
    if (!merged) throw new Error('Closed glazing seal geometry could not merge')
    const sealMesh = new THREE.Mesh(merged, sealMaterial)
    sealMesh.name = 'Glazing_Closed_Rubber_Gaskets'
    sealMesh.castShadow = true; sealMesh.receiveShadow = true
    sealTriangles = (merged.index?.count || 0) / 3
    sealVertices = merged.getAttribute('position').count
    group.add(sealMesh)
  }
  group.userData = {
    glazingRefinementVersion: 1, sourceMeshes: sourceMeshes.length,
    closedLoops: loops.length, loopVertexCounts: loops.map(loop => loop.length),
    sourceLoopVertexCounts: outlines.map(loop => loop.length), contourTolerance,
    smoothedVertices, sealVertices, sealTriangles, sealRadius: SEAL_RADIUS,
    sealOffset: SEAL_OFFSET, invalidVertices, invalidFaces, nonManifoldEdges,
    skippedComponents, finite: invalidVertices === 0,
  }
  root.add(group)
  return group
}
