import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { refineLightTwinGeometry } from './refineLightTwin'
import { refineProductionAirframe, isProtectedRotor } from './productionAirframe'

/** EC135-class light twin; Heiko Schulz geometry, GPL-2.0. See aircraft source package. */
export async function loadLightTwin(samples: number, tailSamples: number) {
  const gltf = await new GLTFLoader().loadAsync('/campaign/light-twin/light-twin-refined-v6.glb')
  const root = gltf.scene
  const airframe = root.getObjectByName('LightTwin_Aircraft')!
  const head = root.getObjectByName('MainRotor_RIG')!
  const tail = root.getObjectByName('TailRotor_RIG')!
  if (!airframe || !head || !tail) throw new Error('Aircraft rig is incomplete')
  const nativeRefined = airframe.userData.productionRefinement === 6
  // Separate enamel, glazing and hardware rather than giving every surface
  // the same clear-coated appearance. Keep original baked maps and normals.
  const tuned = new Set<THREE.Material>()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const list = Array.isArray(object.material) ? object.material : [object.material]
    if (nativeRefined && !isProtectedRotor(object)) {
      for (const m of list) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue
        if (/^Reference /.test(m.name)) m.envMapIntensity = 1.05
        if (/glazing/i.test(m.name)) m.envMapIntensity = 1.15
      }
      return
    }
    for (const material of list) {
      if (!(material instanceof THREE.MeshStandardMaterial) || tuned.has(material)) continue
      tuned.add(material)
      const physical = material instanceof THREE.MeshPhysicalMaterial ? material : undefined
      if (/Deep navy enamel/.test(material.name)) {
        material.metalness = .03
        material.roughness = .27
        material.envMapIntensity = .8
        if (physical) { physical.clearcoat = .45; physical.clearcoatRoughness = .18 }
        // Original baked navy/gold paint, with restrained panel relief.
        material.normalScale.setScalar(.38)
      } else if (/glazing/i.test(material.name)) {
        material.color.set('#425d6d')
        material.roughness = .065
        material.metalness = 0
        material.transparent = true
        material.opacity = .86
        material.depthWrite = false
        material.side = THREE.FrontSide
        if (physical) {
          // Screen-space transmission cannot see the CSS mountain landscape.
          physical.transmission = 0
          physical.clearcoat = 1
          physical.clearcoatRoughness = .055
          physical.ior = 1.46
          physical.envMapIntensity = .95
        }
      } else if (/titanium/i.test(material.name)) {
        material.roughness = .4
        material.metalness = .78
        if (physical) physical.clearcoat = 0
      } else if (/rubber|fittings/i.test(material.name)) {
        material.roughness = .78
        material.metalness = 0
        if (physical) physical.clearcoat = 0
      }
      material.needsUpdate = true
    }
  })
  const replacedGeometries: THREE.BufferGeometry[] = []
  if (nativeRefined) {
    // The native asset keeps the original rig bytes. Reapply ONLY the existing
    // stationary-mechanical crease treatment used by the previous renderer.
    // Blade meshes, shared rotor materials and shutter sampling stay identical.
    head.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      if (/handle|wirecutter|exhaust|engine|standardstep|mast|swashplate|scissor|pitchlink/.test(object.name)) {
        replacedGeometries.push(object.geometry)
        object.geometry = toCreasedNormals(object.geometry, THREE.MathUtils.degToRad(50))
      }
    })
  } else {
    refineLightTwinGeometry(airframe, replacedGeometries)
    refineProductionAirframe(airframe, replacedGeometries)
  }
  const bladeGhosts: THREE.Group[] = []
  const tailGhosts: THREE.Group[] = []
  const rotorInstances: { mesh: THREE.InstancedMesh; transforms: THREE.Group[] }[] = []
  const geometries = new Set<THREE.BufferGeometry>()
  replacedGeometries.forEach(geometry => geometries.add(geometry))
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  tuned.forEach(material => {
    materials.add(material)
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
  })
  function collect(o: THREE.Object3D) {
    if (!(o instanceof THREE.Mesh)) return
    geometries.add(o.geometry)
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m)
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value)
    }
  }
  root.traverse(collect)
  root.updateMatrixWorld(true)

  function sampledRotor(pivot: THREE.Object3D, parts: THREE.Object3D[], count: number, result: THREE.Group[]) {
    const meshes: THREE.Mesh[] = []
    parts.forEach(part => part.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o) }))
    if (!meshes.length) throw new Error('Rotor blades are missing')
    const inverse = pivot.matrixWorld.clone().invert()
    const temporary = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)))
    const merged = mergeGeometries(temporary, false)
    temporary.forEach(g => g.dispose())
    if (!merged) throw new Error('Rotor geometry could not be merged')
    const source = Array.isArray(meshes[0].material) ? meshes[0].material[0] : meshes[0].material
    for (const part of parts) pivot.remove(part)
    const rotorMaterial = source.clone()
    rotorMaterial.transparent = true
    rotorMaterial.opacity = 1 / count
    rotorMaterial.depthWrite = false
    rotorMaterial.depthTest = true
    // All samples use identical geometry/material. Instancing preserves every
    // shutter sample and its depth test while avoiding one draw per sample.
    const instanced = new THREE.InstancedMesh(merged, rotorMaterial, count)
    instanced.name = `${pivot.name}_ShutterSamples`
    instanced.frustumCulled = false
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    instanced.castShadow = false
    airframe.add(instanced)
    for (let i = 0; i < count; i++) {
      const ghost = new THREE.Group()
      ghost.position.copy(pivot.position)
      result.push(ghost)
    }
    rotorInstances.push({ mesh: instanced, transforms: result })
  }
  sampledRotor(head, [...head.children].filter(o => /^blade[1-4]/.test(o.name)), samples, bladeGhosts)
  sampledRotor(tail, [...tail.children], tailSamples, tailGhosts)

  // Collect the original removed parts too; clones share geometry but not materials.
  root.traverse(collect)
  // glTF surfaces use baked paint maps, not unsupported procedural shader nodes.
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.frustumCulled = !(object instanceof THREE.InstancedMesh)
    const mat = Array.isArray(object.material) ? object.material : [object.material]
    if (mat.every(m => !m.transparent)) { object.castShadow = true; object.receiveShadow = true }
  })
  return {
    root, head, tail, bladeGhosts, tailGhosts,
    updateRotorInstances() {
      for (const { mesh, transforms } of rotorInstances) {
        transforms.forEach((transform, i) => { transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix) })
        mesh.instanceMatrix.needsUpdate = true
      }
    },
    dispose() {
      rotorInstances.forEach(({ mesh }) => mesh.dispose())
      geometries.forEach(g => g.dispose())
      materials.forEach(m => m.dispose())
      textures.forEach(t => t.dispose())
    },
  }
}
