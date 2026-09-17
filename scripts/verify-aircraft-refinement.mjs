import fs from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { refineLightTwinGeometry } from '../src/three/refineLightTwin.ts'

// Geometry-only parse: no DOM, GPU or replacement texture interpretation.
globalThis.ProgressEvent ??= class { constructor(type, values) { this.type = type; Object.assign(this, values) } }
const bytes = fs.readFileSync(new URL('../public/campaign/light-twin/light-twin-web.glb', import.meta.url))
const jsonLength = bytes.readUInt32LE(12)
const json = JSON.parse(bytes.subarray(20, 20 + jsonLength))
const bin = bytes.subarray(28 + jsonLength)
json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString('base64')}`
delete json.images; delete json.textures; delete json.samplers
for (const material of json.materials) {
  for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) delete material[key]
  delete material.pbrMetallicRoughness.baseColorTexture
  delete material.pbrMetallicRoughness.metallicRoughnessTexture
}
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '')
const airframe = gltf.scene.getObjectByName('LightTwin_Aircraft')
assert.ok(airframe)
const head = airframe.getObjectByName('MainRotor_RIG')
const tail = airframe.getObjectByName('TailRotor_RIG')
const pivots = [head.position.clone(), tail.position.clone()]
const originals = []
refineLightTwinGeometry(airframe, originals)
assert.ok(!airframe.getObjectByName('highskid').visible)
assert.ok(!airframe.getObjectByName('antenna').visible)
assert.ok(head.position.equals(pivots[0]) && tail.position.equals(pivots[1]))
const details = airframe.getObjectByName('Airframe_Refinement_Details')
assert.equal(details.children.length, 4)
let triangles = 0
for (const mesh of details.children) {
  assert.ok(mesh.geometry.getAttribute('position').count > 0)
  for (const name of ['position', 'normal']) {
    assert.ok([...mesh.geometry.getAttribute(name).array].every(Number.isFinite))
  }
  triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3
}
assert.ok(triangles < 60000, `Detail budget exceeded: ${triangles}`)
console.log(JSON.stringify({passed:true, addedDrawCalls:details.children.length, detailTriangles:triangles, creaseCorrectedParts:originals.length, rotorPivotsUnchanged:true}, null, 2))
