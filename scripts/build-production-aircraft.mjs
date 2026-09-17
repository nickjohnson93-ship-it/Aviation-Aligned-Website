import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { refineLightTwinGeometry } from '../src/three/refineLightTwin.ts'
import { refineProductionAirframe, isProtectedRotor } from '../src/three/productionAirframe.ts'
import { writeRefinedGlb } from './append-refined-glb.mjs'
import { createExhaustAirflow } from '../src/three/exhaustAirflow.ts'
import { auditProtectedRuntime } from './audit-protected-runtime.mjs'

globalThis.ProgressEvent ??= class { constructor(type, values) { this.type = type; Object.assign(this, values) } }
const sourceUrl = new URL('../public/campaign/light-twin/light-twin-web.glb', import.meta.url)
const outputUrl = new URL('../public/campaign/light-twin/light-twin-refined-v6.glb', import.meta.url)
const source = await fs.readFile(sourceUrl)
const protectedRuntimeAudit = await auditProtectedRuntime()
// Texture objects retain native glTF references; original PNGs stay embedded
// byte-for-byte. No DOM/image decode/repaint or raster aircraft replacement.
const loader = new GLTFLoader().register(parser => ({ name: 'NativeTextureReferences',
  loadTexture(index) {
    const texture = new THREE.Texture()
    texture.name = parser.json.images[parser.json.textures[index].source]?.name || `Source texture ${index}`
    texture.flipY = false; texture.userData.gltfTextureIndex = index
    parser.associations.set(texture, { textures: index })
    return Promise.resolve(texture)
  },
}))
const gltf = await loader.parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '')
for (const [object, association] of gltf.parser.associations) {
  if (association.nodes !== undefined) object.userData.gltfNodeIndex = association.nodes
  if (association.materials !== undefined) object.userData.gltfMaterialIndex = association.materials
  if (association.textures !== undefined) object.userData.gltfTextureIndex = association.textures
}
const root = gltf.scene, airframe = root.getObjectByName('LightTwin_Aircraft')
assert.ok(airframe)
const rotorObjects = []
airframe.traverse(object => { if (isProtectedRotor(object)) rotorObjects.push(object) })
const rotorSnapshot = rotorObjects.map(object => ({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), parent: object.parent, children: [...object.children] }))
const originalBladeBuffers = rotorObjects.filter(o => o.isMesh && /^blade|^Tblade$/.test(o.name)).map(o => ({ mesh:o, geometry:o.geometry, material:o.material }))
const replaced = []
refineLightTwinGeometry(airframe, replaced)
refineProductionAirframe(airframe, replaced)
assert.equal(airframe.userData.lowerFuselageQA?.matchedOriginalPart, true, 'Both user-marked lower attachments must match the verified source')
const floorQA = airframe.userData.cockpitFloorQA
assert.equal(floorQA?.matchedOriginalPart, true, 'The retained cabin floor must be replaced by a verified enclosed footprint')
assert.equal(floorQA.verifiedBothHullSides, true)
assert.ok(floorQA.minimumMeasuredClearanceMetres >= .0179, 'The interior floor must clear both source hull sides by about 18 mm')
assert.ok(airframe.getObjectByName('Cockpit_Production_Refinement').userData.detailTriangles < 5000, 'Cockpit detail budget exceeded')
for (const snapshot of rotorSnapshot) {
  const o = snapshot.object
  assert.ok(o.position.equals(snapshot.position) && o.quaternion.equals(snapshot.quaternion) && o.scale.equals(snapshot.scale))
  assert.equal(o.parent, snapshot.parent); assert.deepEqual(o.children, snapshot.children)
}
for (const {mesh, geometry, material} of originalBladeBuffers) { assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material) }
let triangles = 0, nonFinite = 0, degenerate = 0, normalsInvalid = 0, meshes = 0
const meshWarnings = []
airframe.traverse(o => {
  if (!o.isMesh || !o.visible) return
  meshes++
  const p = o.geometry.getAttribute('position'), n = o.geometry.getAttribute('normal'), idx = o.geometry.index
  const count = idx?.count ?? p.count
  const beforeDegenerate = degenerate, beforeNormals = normalsInvalid
  triangles += count/3
  for (const attr of Object.values(o.geometry.attributes)) for (let i=0;i<attr.array.length;i++) if (!Number.isFinite(attr.array[i])) nonFinite++
  for (let i=0;i<n.count;i++) {const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(Math.abs(length-1)>.025)normalsInvalid++}
  for (let i=0;i<count;i+=3) {
    const a = new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i)
    const b = new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1)
    const c = new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2)
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)degenerate++
  }
  if (beforeDegenerate !== degenerate || beforeNormals !== normalsInvalid) meshWarnings.push({name:o.name, degenerate:degenerate-beforeDegenerate, normalsInvalid:normalsInvalid-beforeNormals})
})
if (meshWarnings.length) console.log(JSON.stringify(meshWarnings))
assert.equal(nonFinite, 0); assert.equal(normalsInvalid, 0); assert.equal(degenerate, 0)
assert.ok(triangles < 100000, `Realtime geometry budget exceeded: ${triangles}`)
const report = await writeRefinedGlb(fileURLToPath(sourceUrl), fileURLToPath(outputUrl), root, {
  correspondingSource: 'aircraft-refinement-source-v6.zip',
})
const hash = async url => createHash('sha256').update(await fs.readFile(url)).digest('hex')
report.productionGeometryQA = { triangles, meshes, nonFinite, degenerate, normalsInvalid, ...airframe.userData.productionQA }
report.protectedRuntimeHashes = {
  LightTwinScene: await hash(new URL('../src/components/LightTwinScene.tsx', import.meta.url)),
  choreography: await hash(new URL('../src/three/choreography.ts', import.meta.url)),
}
report.protectedRuntimeAudit = protectedRuntimeAudit
report.glazing = airframe.getObjectByName('Airframe_Refinement_Closed_Glazing')?.userData
report.cockpit = airframe.getObjectByName('Cockpit_Production_Refinement')?.userData
report.panels = airframe.getObjectByName('Aircraft_Panel_Refinement')?.userData
report.intakes = airframe.getObjectByName('Engine_Intake_Production_Refinement')?.userData
report.brand = airframe.getObjectByName('Aviation_Aligned_Reverse_A_Monogram')?.userData
report.lowerFuselage = airframe.userData.lowerFuselageQA
report.rearBulkhead = airframe.getObjectByName('Airframe_Refinement_Details').userData.rearBulkheadQA
assert.ok(report.rearBulkhead.bothHullSidesVerified && report.rearBulkhead.minimumClearanceMetres >= .018)
// Airflow is a removable web-only cue, not permanently baked into the mesh.
const airflow = createExhaustAirflow(airframe)
assert.equal(airflow.root.parent, null)
airflow.setEnabled(false); assert.equal(airflow.root.visible, false)
airflow.setEnabled(true); assert.equal(airflow.root.visible, true)
airflow.update(17.3); airflow.update(Infinity)
let airflowTriangles=0
airflow.root.traverse(o=>{
  if(!o.isMesh)return
  airflowTriangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3
  for(const attr of Object.values(o.geometry.attributes)) assert.ok([...attr.array].every(Number.isFinite))
})
report.airflow={...airflow.root.userData,triangles:airflowTriangles,toggleTestPassed:true,runtimeOnly:true}
airflow.dispose(); airflow.dispose()
const reportUrl = new URL('../docs/aircraft-refinement-v6-qa.json', import.meta.url)
// Generated validation output is a build artifact, not handwritten source.
await fs.writeFile(reportUrl, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
