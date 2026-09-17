/**
 * Append-only native glTF 2.0 refinement export.
 * Original meshes, accessors, images, textures, materials and BIN bytes remain
 * intact. Only non-rotor nodes are repointed to appended refined mesh data.
 * No browser, image decoder, Blender installation or GLTFExporter is needed.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const ATTRIBUTE_NAMES = {
  position: 'POSITION', normal: 'NORMAL', tangent: 'TANGENT',
  uv: 'TEXCOORD_0', uv1: 'TEXCOORD_1', uv2: 'TEXCOORD_2', uv3: 'TEXCOORD_3',
  color: 'COLOR_0', skinIndex: 'JOINTS_0', skinWeight: 'WEIGHTS_0',
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => JSON.parse(JSON.stringify(value))
const close = (a, b, tolerance = 1e-7) => Math.abs(a - b) <= tolerance

function parseGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Not a GLB')
  assert.equal(bytes.readUInt32LE(4), 2, 'Only glTF 2.0 is supported')
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'Incorrect GLB total length')
  let json, bin
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset)
    const type = bytes.readUInt32LE(offset + 4)
    assert.ok(offset + 8 + length <= bytes.length, 'Truncated GLB chunk')
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) {
      assert.ok(!json, 'Multiple JSON chunks are unsupported')
      json = JSON.parse(chunk.toString('utf8').trim())
    } else if (type === 0x004e4942) {
      assert.ok(!bin, 'Multiple BIN chunks are unsupported')
      bin = chunk
    } else throw new Error(`Unsupported GLB chunk ${type.toString(16)}`)
    offset += 8 + length
  }
  assert.ok(json && bin, 'A JSON and a BIN chunk are required')
  assert.equal(json.buffers.length, 1, 'Only one embedded buffer is supported')
  assert.ok(!json.buffers[0].uri, 'External source buffers are unsupported')
  assert.ok(json.buffers[0].byteLength <= bin.length, 'Source buffer exceeds BIN chunk')
  return { json, bin }
}

function rotorProtection(json) {
  const nodes = new Set()
  const roots = ['MainRotor_RIG', 'TailRotor_RIG'].map(name => {
    const index = json.nodes.findIndex(node => node.name === name)
    assert.ok(index >= 0, `Missing protected ${name}`)
    return index
  })
  const visit = index => {
    if (nodes.has(index)) return
    nodes.add(index)
    for (const child of json.nodes[index].children || []) visit(child)
  }
  roots.forEach(visit)
  const meshes = new Set(), materials = new Set(), accessors = new Set()
  for (const index of nodes) {
    const meshIndex = json.nodes[index].mesh
    if (meshIndex === undefined) continue
    meshes.add(meshIndex)
    for (const primitive of json.meshes[meshIndex].primitives) {
      if (primitive.material !== undefined) materials.add(primitive.material)
      for (const accessor of Object.values(primitive.attributes)) accessors.add(accessor)
      if (primitive.indices !== undefined) accessors.add(primitive.indices)
    }
  }
  return { roots, nodes, meshes, materials, accessors }
}

function accessorValue(json, bin, accessorIndex, row, component) {
  const accessor = json.accessors[accessorIndex]
  assert.ok(!accessor.sparse, 'Sparse source accessor is unsupported')
  const view = json.bufferViews[accessor.bufferView]
  const width = BYTES[accessor.componentType]
  const stride = view.byteStride || width * COMPONENTS[accessor.type]
  const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + row * stride + component * width
  let value
  switch (accessor.componentType) {
    case 5120: value = bin.readInt8(offset); break
    case 5121: value = bin.readUInt8(offset); break
    case 5122: value = bin.readInt16LE(offset); break
    case 5123: value = bin.readUInt16LE(offset); break
    case 5125: value = bin.readUInt32LE(offset); break
    case 5126: value = bin.readFloatLE(offset); break
    default: throw new Error('Unsupported source component type')
  }
  if (accessor.normalized) {
    if (accessor.componentType === 5120) value = Math.max(value / 127, -1)
    if (accessor.componentType === 5121) value /= 255
    if (accessor.componentType === 5122) value = Math.max(value / 32767, -1)
    if (accessor.componentType === 5123) value /= 65535
  }
  return value
}

function attributeValue(attribute, row, component) {
  if (typeof attribute.getComponent === 'function') return attribute.getComponent(row, component)
  return [attribute.getX, attribute.getY, attribute.getZ, attribute.getW][component].call(attribute, row)
}

function equalAttribute(attribute, json, bin, accessorIndex) {
  if (accessorIndex === undefined) return false
  const source = json.accessors[accessorIndex]
  if (source.count !== attribute.count || COMPONENTS[source.type] !== attribute.itemSize) return false
  for (let row = 0; row < attribute.count; row++) {
    for (let component = 0; component < attribute.itemSize; component++) {
      if (!close(attributeValue(attribute, row, component), accessorValue(json, bin, accessorIndex, row, component))) return false
    }
  }
  return true
}

function assertFiniteArray(values, name) {
  for (const value of values) assert.ok(Number.isFinite(value), `Non-finite ${name}`)
}

function nodeTransform(object) {
  if (object.matrixAutoUpdate) object.updateMatrix()
  if (!object.matrixAutoUpdate) {
    const matrix = object.matrix.toArray()
    assertFiniteArray(matrix, `${object.name} matrix`)
    return { matrix }
  }
  const translation = object.position.toArray()
  const rotation = object.quaternion.toArray()
  const scale = object.scale.toArray()
  assertFiniteArray([...translation, ...rotation, ...scale], `${object.name} transform`)
  const result = {}
  if (!translation.every(value => value === 0)) result.translation = translation
  if (!rotation.every((value, i) => value === (i === 3 ? 1 : 0))) result.rotation = rotation
  if (!scale.every(value => value === 1)) result.scale = scale
  return result
}

function assertOriginalTransform(object, node) {
  const current = nodeTransform(object)
  if (node.matrix) {
    assert.ok(node.matrix.every((value, i) => close(value, object.matrix.elements[i], 1e-6)), `Original matrix changed: ${node.name}`)
    return
  }
  for (const [key, fallback] of [
    ['translation', [0, 0, 0]], ['rotation', [0, 0, 0, 1]], ['scale', [1, 1, 1]],
  ]) {
    const a = node[key] || fallback, b = current[key] || fallback
    // q and -q represent the identical orientation.
    const same = a.every((value, i) => close(value, b[i], 1e-6))
    const opposite = key === 'rotation' && a.every((value, i) => close(value, -b[i], 1e-6))
    assert.ok(same || opposite, `Original ${key} changed: ${node.name}`)
  }
}

/**
 * Association contract (attach before refinement, copying userData on clones):
 * object.userData.gltfNodeIndex; material.userData.gltfMaterialIndex;
 * texture.userData.gltfTextureIndex. Unique original names are safe fallbacks.
 * options.strictTransforms defaults true; validateOnly skips artifact writes.
 * New raster maps are deliberately not
 * encoded: all referenced textures must already exist in the source GLB.
 * Returns a detailed validation/stats report after writing and reading output.
 */
export async function writeRefinedGlb(sourcePath, outputPath, root, options = {}) {
  const sourceBytes = await fs.readFile(sourcePath)
  const { json: source, bin: sourceBin } = parseGlb(sourceBytes)
  const json = clone(source)
  const protection = rotorProtection(source)
  const chunks = [sourceBin]
  let binLength = sourceBin.length
  const warnings = new Set()
  const stats = { appendedNodes: 0, appendedMeshes: 0, appendedMaterials: 0, appendedAccessors: 0, reusedAccessors: 0, hiddenOriginalNodes: [], refinedOriginalNodes: [] }
  const names = new Map()
  source.nodes.forEach((node, index) => {
    if (!node.name) return
    const sanitized = node.name.replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '')
    for (const name of new Set([node.name, sanitized])) {
      if (!names.has(name)) names.set(name, [])
      names.get(name).push(index)
    }
  })
  const objects = new Map(), objectIndices = new Map()
  root.traverse(object => {
    let index = object.userData?.gltfNodeIndex
    if (index === undefined) {
      const candidates = names.get(object.name)
      if (candidates?.length === 1) index = candidates[0]
    }
    if (index === undefined) return
    assert.ok(Number.isInteger(index) && source.nodes[index], `Invalid node association: ${object.name}`)
    assert.ok(!objects.has(index), `Duplicate original node association: ${object.name}`)
    objects.set(index, object)
    objectIndices.set(object, index)
  })
  for (let i = 0; i < source.nodes.length; i++) {
    assert.ok(objects.has(i), `Source node missing from refinement scene: ${source.nodes[i].name || i}`)
    if (options.strictTransforms !== false) assertOriginalTransform(objects.get(i), source.nodes[i])
  }

  const appendBinary = (array, target) => {
    const pad = (4 - binLength % 4) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); binLength += pad }
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
    const index = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: binLength, byteLength: bytes.length, target })
    chunks.push(bytes); binLength += bytes.length
    return index
  }
  const appendAccessor = (values, itemSize, componentType, target, bounds = false) => {
    assertFiniteArray(values, 'appended accessor')
    const type = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' }[itemSize]
    assert.ok(type, `Unsupported appended attribute width ${itemSize}`)
    const accessor = { bufferView: appendBinary(values, target), componentType, count: values.length / itemSize, type }
    assert.ok(Number.isInteger(accessor.count), 'Non-integral accessor count')
    if (bounds) {
      accessor.min = Array(itemSize).fill(Infinity)
      accessor.max = Array(itemSize).fill(-Infinity)
      for (let i = 0; i < values.length; i++) {
        const c = i % itemSize
        accessor.min[c] = Math.min(accessor.min[c], values[i])
        accessor.max[c] = Math.max(accessor.max[c], values[i])
      }
    }
    const index = json.accessors.length
    json.accessors.push(accessor); stats.appendedAccessors++
    return index
  }
  const useExtension = name => {
    json.extensionsUsed ||= []
    if (!json.extensionsUsed.includes(name)) json.extensionsUsed.push(name)
  }

  const textureIndex = (texture, sourceInfo) => {
    let index = texture.userData?.gltfTextureIndex
    if (index === undefined && sourceInfo) {
      const candidate = sourceInfo.index
      const name = source.images[source.textures[candidate]?.source]?.name
      if (!texture.name || texture.name === name || texture.name === source.textures[candidate]?.name) index = candidate
    }
    if (index === undefined) {
      const candidates = source.textures.map((entry, i) => ({ entry, i })).filter(({ entry }) => entry.name === texture.name || source.images[entry.source]?.name === texture.name)
      // Identical image + sampler duplicate texture slots are interchangeable.
      if (candidates.length && candidates.every(({ entry }) => JSON.stringify(entry) === JSON.stringify(candidates[0].entry))) index = candidates[0].i
      else if (candidates.length === 1) index = candidates[0].i
    }
    assert.ok(Number.isInteger(index) && source.textures[index], `Texture has no source association: ${texture.name || texture.uuid}; attach userData.gltfTextureIndex before refining`)
    return index
  }
  const textureInfo = (texture, sourceInfo) => {
    if (!texture) return undefined
    const info = { index: textureIndex(texture, sourceInfo) }
    const channel = texture.channel || 0
    if (channel) info.texCoord = channel
    const offset = texture.offset?.toArray() || [0, 0]
    const scale = texture.repeat?.toArray() || [1, 1]
    const rotation = texture.rotation || 0
    const center = texture.center?.toArray() || [0, 0]
    if (offset.some(value => value !== 0) || scale.some(value => value !== 1) || rotation !== 0 || center.some(value => value !== 0)) {
      // Match the installed GLTFLoader/GLTFExporter texture rotation convention.
      // Fold Three's optional centre pivot into glTF's offset.
      const c = Math.cos(rotation), s = Math.sin(rotation)
      info.extensions = { KHR_texture_transform: {
        offset: [offset[0] + center[0] - scale[0] * (c * center[0] + s * center[1]), offset[1] + center[1] - scale[1] * (-s * center[0] + c * center[1])],
        scale, rotation,
      } }
      useExtension('KHR_texture_transform')
    }
    return info
  }
  const materialIndices = new Map()
  const serializeMaterial = material => {
    assert.ok(material?.isMeshStandardMaterial || material?.isMeshBasicMaterial, `Unsupported material: ${material?.name}`)
    if (materialIndices.has(material)) return materialIndices.get(material)
    let sourceIndex = material.userData?.gltfMaterialIndex
    if (sourceIndex === undefined) {
      const matches = source.materials.map((entry, i) => ({ entry, i })).filter(({ entry }) => entry.name === material.name)
      if (matches.length === 1) sourceIndex = matches[0].i
    }
    const original = source.materials[sourceIndex] || {}
    const opbr = original.pbrMetallicRoughness || {}
    const pbr = {
      baseColorFactor: [...material.color.toArray(), material.opacity ?? 1],
      metallicFactor: material.metalness ?? 0,
      roughnessFactor: material.roughness ?? 1,
    }
    const result = { name: material.name || 'Refined PBR', pbrMetallicRoughness: pbr }
    const addTexture = (owner, key, texture, baseline) => {
      const info = textureInfo(texture, baseline)
      if (info) owner[key] = info
    }
    addTexture(pbr, 'baseColorTexture', material.map, opbr.baseColorTexture)
    assert.ok(!material.roughnessMap || !material.metalnessMap || material.roughnessMap === material.metalnessMap, `Separate roughness/metallic maps require packing: ${material.name}`)
    addTexture(pbr, 'metallicRoughnessTexture', material.roughnessMap || material.metalnessMap, opbr.metallicRoughnessTexture)
    addTexture(result, 'normalTexture', material.normalMap, original.normalTexture)
    if (result.normalTexture) {
      result.normalTexture.scale = material.normalScale?.x ?? 1
      // GLTFLoader intentionally flips y for meshes using derivative tangents.
      if (material.normalScale && !close(Math.abs(material.normalScale.x), Math.abs(material.normalScale.y))) warnings.add(`glTF supports scalar normal scale only: ${material.name}`)
    }
    addTexture(result, 'occlusionTexture', material.aoMap, original.occlusionTexture)
    if (result.occlusionTexture) result.occlusionTexture.strength = material.aoMapIntensity ?? 1
    if (material.emissive) {
      const intensity = material.emissiveIntensity ?? 1
      result.emissiveFactor = material.emissive.toArray().map(value => value * Math.min(intensity, 1))
      addTexture(result, 'emissiveTexture', material.emissiveMap, original.emissiveTexture)
      if (intensity > 1) {
        result.extensions = { KHR_materials_emissive_strength: { emissiveStrength: intensity } }
        useExtension('KHR_materials_emissive_strength')
      }
    }
    if (material.alphaTest > 0) { result.alphaMode = 'MASK'; result.alphaCutoff = material.alphaTest }
    else if (material.transparent || material.opacity < 1) result.alphaMode = 'BLEND'
    if (material.side === 2) result.doubleSided = true
    if (material.side === 1) warnings.add(`BackSide cannot be represented without reversing triangles: ${material.name}`)
    if (material.alphaMap && material.alphaMap !== material.map) throw new Error(`Separate alpha map cannot be preserved natively: ${material.name}`)
    if (material.isMeshBasicMaterial) { result.extensions ||= {}; result.extensions.KHR_materials_unlit = {}; useExtension('KHR_materials_unlit') }
    if (material.isMeshPhysicalMaterial) {
      const extension = (name, data) => { result.extensions ||= {}; result.extensions[name] = data; useExtension(name); return data }
      if (material.clearcoat > 0 || material.clearcoatMap) {
        const e = extension('KHR_materials_clearcoat', { clearcoatFactor: material.clearcoat, clearcoatRoughnessFactor: material.clearcoatRoughness })
        const old = original.extensions?.KHR_materials_clearcoat || {}
        addTexture(e, 'clearcoatTexture', material.clearcoatMap, old.clearcoatTexture)
        addTexture(e, 'clearcoatRoughnessTexture', material.clearcoatRoughnessMap, old.clearcoatRoughnessTexture)
        addTexture(e, 'clearcoatNormalTexture', material.clearcoatNormalMap, old.clearcoatNormalTexture)
        if (e.clearcoatNormalTexture) e.clearcoatNormalTexture.scale = material.clearcoatNormalScale?.x ?? 1
      }
      if (material.transmission > 0 || material.transmissionMap) {
        const e = extension('KHR_materials_transmission', { transmissionFactor: material.transmission })
        addTexture(e, 'transmissionTexture', material.transmissionMap, original.extensions?.KHR_materials_transmission?.transmissionTexture)
      }
      if (material.ior !== undefined && material.ior !== 1.5) extension('KHR_materials_ior', { ior: material.ior })
      if (material.specularIntensity !== 1 || material.specularColor?.toArray().some(value => value !== 1) || material.specularIntensityMap || material.specularColorMap) {
        const e = extension('KHR_materials_specular', { specularFactor: material.specularIntensity, specularColorFactor: material.specularColor.toArray() })
        const old = original.extensions?.KHR_materials_specular || {}
        addTexture(e, 'specularTexture', material.specularIntensityMap, old.specularTexture)
        addTexture(e, 'specularColorTexture', material.specularColorMap, old.specularColorTexture)
      }
      if (material.thickness > 0) {
        const e = extension('KHR_materials_volume', { thicknessFactor: material.thickness, attenuationColor: material.attenuationColor.toArray() })
        if (Number.isFinite(material.attenuationDistance)) e.attenuationDistance = material.attenuationDistance
        addTexture(e, 'thicknessTexture', material.thicknessMap, original.extensions?.KHR_materials_volume?.thicknessTexture)
      }
    }
    assertFiniteArray(pbr.baseColorFactor, `${material.name} base colour`)
    assertFiniteArray([pbr.metallicFactor, pbr.roughnessFactor], `${material.name} PBR`)
    assert.ok(pbr.baseColorFactor.every(value => value >= 0 && value <= 1), `Out-of-range base colour: ${material.name}`)
    const index = json.materials.length
    json.materials.push(result); materialIndices.set(material, index); stats.appendedMaterials++
    return index
  }

  const geometryCache = new Map()
  const serializeGeometry = (geometry, originalPrimitive, materials) => {
    assert.ok(geometry?.isBufferGeometry, 'Expected BufferGeometry')
    assert.ok(!Object.values(geometry.morphAttributes || {}).some(entries => entries.length), 'Morph refinement requires an explicit morph serializer')
    assert.ok(!materials.some(material => material?.isShaderMaterial), 'Custom shaders cannot export as native PBR')
    let cached = geometryCache.get(geometry)
    if (!cached) {
      const attributes = {}
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const semantic = ATTRIBUTE_NAMES[name] || (name.startsWith('_') ? name : undefined)
        if (!semantic) { warnings.add(`Unsupported attribute not exported: ${name}`); continue }
        if (name === 'color' && !materials.some(material => material.vertexColors)) continue
        const oldIndex = originalPrimitive?.attributes[semantic]
        if (equalAttribute(attribute, source, sourceBin, oldIndex)) {
          attributes[semantic] = oldIndex; stats.reusedAccessors++; continue
        }
        const values = name === 'skinIndex' ? new Uint16Array(attribute.count * attribute.itemSize) : new Float32Array(attribute.count * attribute.itemSize)
        for (let row = 0; row < attribute.count; row++) {
          for (let component = 0; component < attribute.itemSize; component++) values[row * attribute.itemSize + component] = attributeValue(attribute, row, component)
        }
        attributes[semantic] = appendAccessor(values, attribute.itemSize, name === 'skinIndex' ? 5123 : 5126, 34962, name === 'position')
      }
      assert.ok(attributes.POSITION !== undefined, 'Geometry lacks position attribute')
      cached = { attributes }; geometryCache.set(geometry, cached)
    }
    const count = geometry.index?.count ?? geometry.getAttribute('position').count
    const drawStart = geometry.drawRange?.start || 0
    const drawEnd = Math.min(count, drawStart + (geometry.drawRange?.count ?? Infinity))
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }]
    const primitives = []
    for (const group of groups) {
      const start = Math.max(drawStart, group.start)
      const end = Math.min(drawEnd, group.start + group.count)
      if (end <= start) continue
      assert.ok(start % 3 === 0 && (end - start) % 3 === 0, 'Triangle group is not aligned to whole triangles')
      const indices = []
      let maxIndex = 0
      for (let i = start; i < end; i++) {
        const value = geometry.index ? geometry.index.getX(i) : i
        assert.ok(Number.isInteger(value) && value >= 0 && value < geometry.getAttribute('position').count, `Index out of bounds: ${value}`)
        indices.push(value); maxIndex = Math.max(maxIndex, value)
      }
      let accessorIndex
      if (start === 0 && end === count && geometry.index && equalAttribute(geometry.index, source, sourceBin, originalPrimitive?.indices)) {
        accessorIndex = originalPrimitive.indices; stats.reusedAccessors++
      } else accessorIndex = appendAccessor(maxIndex <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices), 1, maxIndex <= 65535 ? 5123 : 5125, 34963)
      const material = materials[group.materialIndex || 0]
      assert.ok(material, `Group refers to missing material slot ${group.materialIndex}`)
      primitives.push({ attributes: cached.attributes, indices: accessorIndex, material: serializeMaterial(material) })
    }
    assert.ok(primitives.length, 'No visible geometry triangles to export')
    return primitives
  }
  const appendMesh = (object, sourceMesh) => {
    assert.ok(!object.isSkinnedMesh, 'Skinned refinement requires preserving skin associations explicitly')
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const primitives = serializeGeometry(object.geometry, sourceMesh?.primitives?.[0], materials)
    const index = json.meshes.length
    json.meshes.push({ name: object.name || 'Refined mesh', primitives })
    stats.appendedMeshes++
    return index
  }
  for (const [index, object] of objects) {
    if (protection.nodes.has(index)) continue
    const node = json.nodes[index]
    if (node.name === 'LightTwin_Aircraft' && object.userData?.productionRefinement !== undefined) {
      node.extras = { ...clone(source.nodes[index].extras || {}), productionRefinement: object.userData.productionRefinement }
      if (object.userData.productionQA !== undefined) node.extras.productionQA = clone(object.userData.productionQA)
      stats.productionRefinement = object.userData.productionRefinement
    }
    if (node.mesh === undefined) continue
    assert.ok(object.isMesh, `Original mesh node unexpectedly became a group: ${node.name}`)
    if (!object.visible) { delete node.mesh; stats.hiddenOriginalNodes.push(node.name); continue }
    node.mesh = appendMesh(object, source.meshes[source.nodes[index].mesh])
    stats.refinedOriginalNodes.push(node.name)
  }

  const exportAdded = (object, parentIndex) => {
    if (objectIndices.has(object)) return
    if (!object.visible) return
    assert.ok(!protection.nodes.has(parentIndex), `New detail cannot be attached to protected rotor node: ${object.name}`)
    assert.ok(!object.isLight && !object.isCamera, `New scene light/camera is not an aircraft asset: ${object.name}`)
    const node = { name: object.name || 'Refined detail', ...nodeTransform(object) }
    if (object.isMesh) node.mesh = appendMesh(object)
    const index = json.nodes.length
    json.nodes.push(node); stats.appendedNodes++
    objectIndices.set(object, index)
    json.nodes[parentIndex].children ||= []
    json.nodes[parentIndex].children.push(index)
    for (const child of object.children) exportAdded(child, index)
  }
  // Existing child arrays and indices remain stable. Append only genuinely new
  // children to their original parents, recursively preserving local transforms.
  for (const [index, object] of objects) {
    for (const child of object.children) if (!objectIndices.has(child)) exportAdded(child, index)
  }
  const finalBin = Buffer.concat(chunks)
  json.buffers[0].byteLength = finalBin.length
  json.asset.generator = `${source.asset.generator || 'glTF source'}; append-only airframe refinement`
  if (options.correspondingSource) json.asset.extras = {
    ...clone(source.asset.extras || {}),
    correspondingRefinementSource: options.correspondingSource,
    originalCopyrightNoticeRetained: true,
  }
  const rawJson = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonChunk = Buffer.alloc(Math.ceil(rawJson.length / 4) * 4, 0x20)
  rawJson.copy(jsonChunk)
  const binChunk = Buffer.alloc(Math.ceil(finalBin.length / 4) * 4)
  finalBin.copy(binChunk)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  binHeader.writeUInt32LE(binChunk.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  const outputBytes = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk])
  const validation = validateRefinedGlb(sourceBytes, outputBytes)
  if (!options.validateOnly) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, outputBytes)
    assert.equal(sha(await fs.readFile(outputPath)), sha(outputBytes), 'Written artifact does not match validated export')
  }
  return { ...validation, ...stats, sourcePath, outputPath, warnings: [...warnings] }
}

/** Pure validation; accepts source/output GLB Buffers and never mutates files. */
export function validateRefinedGlb(sourceBytes, refinedBytes) {
  const source = parseGlb(sourceBytes), refined = parseGlb(refinedBytes)
  const a = source.json, b = refined.json
  const protection = rotorProtection(a)
  assert.equal(sha(refined.bin.subarray(0, source.bin.length)), sha(source.bin), 'Original BIN prefix changed')
  for (const key of ['meshes', 'materials', 'accessors', 'bufferViews', 'images', 'textures', 'samplers']) {
    assert.deepEqual((b[key] || []).slice(0, (a[key] || []).length), a[key] || [], `Original ${key} changed`)
  }
  assert.deepEqual(b.animations, a.animations, 'Original animation clips changed')
  assert.deepEqual(b.skins, a.skins, 'Original skins changed')
  assert.deepEqual(b.scenes, a.scenes, 'Original scene root hierarchy changed')
  for (const index of protection.nodes) assert.deepEqual(b.nodes[index], a.nodes[index], `Protected rotor node changed: ${a.nodes[index].name}`)
  for (let i = 0; i < a.nodes.length; i++) {
    const old = a.nodes[i], current = b.nodes[i]
    for (const key of ['name', 'matrix', 'translation', 'rotation', 'scale', 'skin', 'weights']) assert.deepEqual(current[key], old[key], `Original node ${key} changed: ${old.name}`)
    assert.deepEqual((current.children || []).slice(0, (old.children || []).length), old.children || [], `Original child hierarchy changed: ${old.name}`)
  }
  for (const [index, accessor] of b.accessors.entries()) {
    assert.ok(COMPONENTS[accessor.type] && BYTES[accessor.componentType], `Unsupported accessor ${index}`)
    assert.ok(Number.isInteger(accessor.count) && accessor.count > 0, `Invalid accessor count ${index}`)
    const view = b.bufferViews[accessor.bufferView]
    assert.ok(view && view.buffer === 0, `Invalid bufferView for accessor ${index}`)
    const width = BYTES[accessor.componentType], components = COMPONENTS[accessor.type]
    const stride = view.byteStride || width * components
    const end = (accessor.byteOffset || 0) + (accessor.count - 1) * stride + width * components
    assert.ok(end <= view.byteLength, `Accessor overruns bufferView: ${index}`)
    assert.ok((view.byteOffset || 0) + view.byteLength <= b.buffers[0].byteLength, `bufferView overruns BIN: ${index}`)
    for (let row = 0; row < accessor.count; row++) {
      for (let c = 0; c < components; c++) assert.ok(Number.isFinite(accessorValue(b, refined.bin, index, row, c)), `Non-finite accessor ${index}`)
    }
  }
  let renderTriangles = 0, renderPrimitives = 0
  for (const node of b.nodes) {
    if (node.mesh === undefined) continue
    assert.ok(b.meshes[node.mesh], 'Node refers to missing mesh')
    for (const primitive of b.meshes[node.mesh].primitives) {
      const position = b.accessors[primitive.attributes.POSITION]
      assert.ok(position?.type === 'VEC3', 'Primitive missing valid POSITION')
      for (const accessorIndex of Object.values(primitive.attributes)) assert.equal(b.accessors[accessorIndex].count, position.count, 'Attribute vertex count mismatch')
      if (primitive.indices !== undefined) {
        const indices = b.accessors[primitive.indices]
        assert.ok(indices.type === 'SCALAR' && [5121, 5123, 5125].includes(indices.componentType), 'Invalid index accessor')
        for (let row = 0; row < indices.count; row++) {
          const value = accessorValue(b, refined.bin, primitive.indices, row, 0)
          assert.ok(Number.isInteger(value) && value >= 0 && value < position.count, 'Triangle index out of bounds')
        }
        assert.equal(indices.count % 3, 0, 'Incomplete indexed triangle')
        renderTriangles += indices.count / 3
      } else {
        assert.equal(position.count % 3, 0, 'Incomplete non-indexed triangle')
        renderTriangles += position.count / 3
      }
      assert.ok(b.materials[primitive.material], 'Primitive refers to missing material')
      renderPrimitives++
    }
  }
  const embeddedImages = (a.images || []).map(image => {
    assert.ok(image.bufferView !== undefined, 'Source image is not embedded')
    const view = a.bufferViews[image.bufferView]
    return { name: image.name, byteLength: view.byteLength, sha256: sha(source.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)) }
  })
  return {
    passed: true, format: 'glTF 2.0 GLB', originalBinaryPrefixUnchanged: true,
    originalBinByteLength: source.bin.length, originalBinSha256: sha(source.bin),
    sourceGlbSha256: sha(sourceBytes), outputGlbSha256: sha(refinedBytes),
    correspondingRefinementSource: b.asset.extras?.correspondingRefinementSource,
    outputByteLength: refinedBytes.length, appendedBinaryBytes: refined.bin.length - source.bin.length,
    originalMeshesMaterialsAccessorsImagesUnchanged: true,
    rotorSubtreesUnchanged: true, protectedRotorNodes: protection.nodes.size,
    protectedRotorMeshes: protection.meshes.size, protectedRotorMaterials: protection.materials.size,
    protectedRotorAccessors: protection.accessors.size,
    sourceAnimationClips: a.animations?.length || 0,
    rotorAnimationNote: 'The source has runtime rotor motion/blur; matching website renderer must accompany this native mesh asset.',
    renderTriangles, renderPrimitives, embeddedImages,
  }
}
