/** Targeted cleanup requested from the lower-door screenshot. The supplied
 * coarse paired boarding-step wedges and blade-like lower nose attachment are
 * hidden, never destructively deleted. Both removals are user-directed.
 * This is not a global airframe reshape or a removal of landing-gear hardware.
 */
import * as THREE from 'three'

type HiddenPart = {
  name: string
  sourceRole: string
  vertices: number
  triangles: number
  airframeBounds: { min: number[]; max: number[] }
  beforeVisible: boolean
  afterVisible: boolean
}

/** Separate evidence for the internal floor replacement. The lower-attachment
 * utility itself adds no geometry; this records the later cockpit-only inset.
 */
export type InteriorFloorQA = {
  refinementVersion: number
  matchedOriginalPart: boolean
  sourceNode?: string
  sourceBounds?: { min: number[]; max: number[] }
  insetBounds?: { min: number[]; max: number[] }
  sourceTriangles?: number
  replacementTriangles?: number
  sourceNodeAndGeometryRetained: boolean
  originalFloorMaterialPreserved: boolean
  floorTopBottomUnchanged: boolean
  verifiedBothHullSides: boolean
  clearanceTargetMetres: number
  minimumMeasuredClearanceMetres?: number
  hullCrossSectionSamples?: number
  skippedReason?: string
}

export type LowerFuselageQA = {
  refinementVersion: number
  matchedOriginalPart: boolean
  hiddenSourceParts: HiddenPart[]
  removedRenderTriangles: number
  geometryMaterialsHierarchyAndTransformsUnchanged: boolean
  skidsAerialsWipersAndRotorsPreserved: boolean
  hullNoseUpperCuttersAndLightsPreserved: boolean
  noNewGeometry: boolean
  interiorFloor?: InteriorFloorQA
  skippedReason?: string
}

function protectedRotor(object: THREE.Object3D) {
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (/^(MainRotor_RIG|TailRotor_RIG)$/.test(ancestor.name)) return true
  }
  return false
}

/** Mutates visibility of ONLY the verified `standardstep` and
 * `wirecutter_down` source objects and
 * returns before/after evidence. Safe to call before or after livery clipping.
 */
export function refineLowerFuselage(airframe: THREE.Object3D): LowerFuselageQA {
  const previous = airframe.userData.lowerFuselageQA as LowerFuselageQA | undefined
  if (previous?.refinementVersion === 2 && previous.matchedOriginalPart) return previous
  const qa: LowerFuselageQA = {
    refinementVersion: 2, matchedOriginalPart: false, hiddenSourceParts: [],
    removedRenderTriangles: 0, geometryMaterialsHierarchyAndTransformsUnchanged: true,
    skidsAerialsWipersAndRotorsPreserved: true,
    hullNoseUpperCuttersAndLightsPreserved: true, noNewGeometry: true,
  }
  airframe.updateMatrixWorld(true)
  const inverse = airframe.matrixWorld.clone().invert()
  const verified = [
    { canonical: 'standardstep', role: 'Source paired coarse boarding-step wedges below cabin doors',
      min: [-.691310, .745006, -.905670], max: [1.972766, .974377, .910072] },
    { canonical: 'wirecutterdown', role: 'User-requested blade-like lower nose attachment and its small braces',
      min: [2.649910, .976811, -.096378], max: [3.175763, 1.188660, .095848] },
  ]
  const skipped: string[] = []
  for (const target of verified) {
    let part: THREE.Mesh | undefined
    airframe.traverse(object => {
      if (object instanceof THREE.Mesh && !protectedRotor(object) &&
        object.name.replace(/[.\s_]/g, '').toLowerCase() === target.canonical) part = object
    })
    const position = part?.geometry.getAttribute('position')
    if (!part || !position) { skipped.push(`${target.canonical}: verified source mesh unavailable`); continue }
    const transform = inverse.clone().multiply(part.matrixWorld)
    const bounds = new THREE.Box3()
    let finite = true
    for (let i = 0; i < position.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(transform)
      if (![point.x, point.y, point.z].every(Number.isFinite)) { finite = false; break }
      bounds.expandByPoint(point)
    }
    // Exact name AND all six measured source bounds must agree within 15 mm.
    // A future replacement is not silently hidden. No face/region filter clips
    // the hull, light covers, glazing, upper cutters or landing-gear mounts.
    const matches = finite && !bounds.isEmpty() &&
      bounds.min.toArray().every((value, axis) => Math.abs(value - target.min[axis]) < .015) &&
      bounds.max.toArray().every((value, axis) => Math.abs(value - target.max[axis]) < .015)
    if (!matches) { skipped.push(`${target.canonical}: name found but source bounds do not match`); continue }
    const triangles = (part.geometry.index?.count ?? position.count) / 3
    const beforeVisible = part.visible
    part.visible = false
    qa.removedRenderTriangles += beforeVisible ? triangles : 0
    qa.hiddenSourceParts.push({
      name: part.name, sourceRole: target.role, vertices: position.count, triangles,
      airframeBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
      beforeVisible, afterVisible: part.visible,
    })
  }
  qa.matchedOriginalPart = qa.hiddenSourceParts.length === verified.length
  if (skipped.length) qa.skippedReason = skipped.join('; ')
  airframe.userData.lowerFuselageQA = qa
  return qa
}
