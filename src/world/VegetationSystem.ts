import * as THREE from 'three'
import { getTerrainHeight } from './TerrainNoise'

// ── Deterministic hash (same as TerrainNoise style) ───────────────────────────

function h(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

// ── Exclusion zones — keep clear of spawn, POIs, and roads ────────────────────

const SPAWN_CLEAR = 55

const CLEAR_ZONES: Array<{ x: number; z: number; r: number }> = [
  { x:  600, z: -400,  r: 90 },   // Firebase Alpha
  { x:  200, z:-1180,  r: 90 },   // Northern Ruins
  { x: -680, z:  820,  r: 90 },   // Firebase Bravo
  { x:  750, z:  420,  r: 90 },   // Dead Drop
  { x: -850, z: -700,  r: 90 },   // Deep Facility
]

function isClearZone(x: number, z: number): boolean {
  if (x * x + z * z < SPAWN_CLEAR * SPAWN_CLEAR) return true
  for (const zone of CLEAR_ZONES) {
    const dx = x - zone.x, dz = z - zone.z
    if (dx * dx + dz * dz < zone.r * zone.r) return true
  }
  return false
}

// ── Tree geometry (shared across all instances) ────────────────────────────────

const FOLIAGE_COLOR  = 0x2a4a1c
const FOLIAGE_COLOR2 = 0x1e3a12   // darker layer
const TRUNK_COLOR    = 0x3e2a18

// ── Main export ───────────────────────────────────────────────────────────────

export function buildVegetation(scene: THREE.Scene): void {
  placeTrees(scene)
  placeGrass(scene)
  placeBoulders(scene)
}

// ── Pine trees — 3-tier cone stack + trunk ────────────────────────────────────

function placeTrees(scene: THREE.Scene): void {
  const TREE_COUNT = 2800
  const WORLD      = 1550   // ±metres from centre

  // Tier geometries (3 cones stacked, decreasing size going up)
  const cone1Geo = new THREE.ConeGeometry(3.2, 5.5, 7)
  const cone2Geo = new THREE.ConeGeometry(2.4, 4.5, 7)
  const cone3Geo = new THREE.ConeGeometry(1.5, 3.5, 7)
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.45, 3.2, 6)

  const mat1  = new THREE.MeshStandardMaterial({ color: FOLIAGE_COLOR,  roughness: 0.92 })
  const mat2  = new THREE.MeshStandardMaterial({ color: FOLIAGE_COLOR2, roughness: 0.92 })
  const tMat  = new THREE.MeshStandardMaterial({ color: TRUNK_COLOR,    roughness: 0.95 })

  const inst1  = new THREE.InstancedMesh(cone1Geo, mat1,  TREE_COUNT)
  const inst2  = new THREE.InstancedMesh(cone2Geo, mat2,  TREE_COUNT)
  const inst3  = new THREE.InstancedMesh(cone3Geo, mat1,  TREE_COUNT)
  const trunk  = new THREE.InstancedMesh(trunkGeo, tMat,  TREE_COUNT)
  inst1.castShadow = inst2.castShadow = inst3.castShadow = trunk.castShadow = true

  const dummy = new THREE.Object3D()
  let count = 0

  for (let attempt = 0; attempt < TREE_COUNT * 6 && count < TREE_COUNT; attempt++) {
    const x = (h(attempt * 3.1, attempt * 7.9 + 1) - 0.5) * WORLD * 2
    const z = (h(attempt * 5.7, attempt * 2.3 + 2) - 0.5) * WORLD * 2

    if (isClearZone(x, z)) continue

    // Cluster density — trees group together
    const cell = Math.floor(x / 40) * 1000 + Math.floor(z / 40)
    if (h(cell * 0.01, 0) > 0.45) continue

    const terrH = getTerrainHeight(x, z)
    if (terrH < 3 || terrH > 165) continue   // no trees in valleys or above snowline

    const scale  = 0.65 + h(x * 0.07, z * 0.09) * 0.7
    const yrot   = h(x * 1.3, z * 2.1) * Math.PI * 2
    const baseY  = terrH

    // Trunk
    dummy.position.set(x, baseY + 1.5 * scale, z)
    dummy.rotation.set(0, yrot, 0)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    trunk.setMatrixAt(count, dummy.matrix)

    // Cone 1 (lowest, widest)
    dummy.position.set(x, baseY + 4.0 * scale, z)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    inst1.setMatrixAt(count, dummy.matrix)

    // Cone 2 (mid)
    dummy.position.set(x, baseY + 6.5 * scale, z)
    dummy.scale.setScalar(scale * 0.88)
    dummy.updateMatrix()
    inst2.setMatrixAt(count, dummy.matrix)

    // Cone 3 (top, smallest)
    dummy.position.set(x, baseY + 8.5 * scale, z)
    dummy.scale.setScalar(scale * 0.72)
    dummy.updateMatrix()
    inst3.setMatrixAt(count, dummy.matrix)

    count++
  }

  for (const inst of [inst1, inst2, inst3, trunk]) {
    inst.count = count
    inst.instanceMatrix.needsUpdate = true
    scene.add(inst)
  }
}

// ── Grass clumps — two crossed planes ─────────────────────────────────────────

function placeGrass(scene: THREE.Scene): void {
  const GRASS_COUNT = 5000
  const WORLD       = 1400

  const geo = new THREE.PlaneGeometry(1.6, 1.4)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a5a22, roughness: 0.95, side: THREE.DoubleSide,
  })

  // Each clump = 2 crossed planes → 2× instance count
  const inst = new THREE.InstancedMesh(geo, mat, GRASS_COUNT * 2)
  inst.castShadow = false

  const dummy  = new THREE.Object3D()
  let count    = 0

  for (let attempt = 0; attempt < GRASS_COUNT * 5 && count < GRASS_COUNT; attempt++) {
    const x = (h(attempt * 2.3 + 300, attempt * 8.1) - 0.5) * WORLD * 2
    const z = (h(attempt * 6.7 + 400, attempt * 3.9) - 0.5) * WORLD * 2

    if (isClearZone(x, z)) continue

    const terrH = getTerrainHeight(x, z)
    if (terrH < 1 || terrH > 130) continue

    const scale = 0.7 + h(x * 0.2, z * 0.3) * 0.6
    const yrot  = h(x * 2.5, z * 1.8) * Math.PI

    const idx = count * 2

    dummy.position.set(x, terrH + 0.65 * scale, z)
    dummy.rotation.set(0, yrot, 0)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    inst.setMatrixAt(idx, dummy.matrix)

    dummy.rotation.set(0, yrot + Math.PI / 2, 0)
    dummy.updateMatrix()
    inst.setMatrixAt(idx + 1, dummy.matrix)

    count++
  }

  inst.count = count * 2
  inst.instanceMatrix.needsUpdate = true
  scene.add(inst)
}

// ── Scattered boulders ────────────────────────────────────────────────────────

function placeBoulders(scene: THREE.Scene): void {
  const BOULDER_COUNT = 400
  const WORLD         = 1500

  const geo = new THREE.DodecahedronGeometry(1, 0)
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.9, metalness: 0.05 })
  const inst = new THREE.InstancedMesh(geo, mat, BOULDER_COUNT)
  inst.castShadow = true

  const dummy = new THREE.Object3D()
  let count   = 0

  for (let attempt = 0; attempt < BOULDER_COUNT * 5 && count < BOULDER_COUNT; attempt++) {
    const x = (h(attempt * 4.1 + 700, attempt * 9.3) - 0.5) * WORLD * 2
    const z = (h(attempt * 7.3 + 800, attempt * 4.7) - 0.5) * WORLD * 2

    if (isClearZone(x, z)) continue
    if (h(x * 0.02, z * 0.02) < 0.7) continue   // sparse

    const terrH = getTerrainHeight(x, z)
    if (terrH < 2 || terrH > 200) continue

    const scale = 0.5 + h(x * 0.1, z * 0.15) * 2.2
    dummy.position.set(x, terrH + scale * 0.5, z)
    dummy.rotation.set(
      h(x, z) * Math.PI * 2,
      h(z, x) * Math.PI * 2,
      h(x + z, z) * Math.PI,
    )
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    inst.setMatrixAt(count, dummy.matrix)
    count++
  }

  inst.count = count
  inst.instanceMatrix.needsUpdate = true
  scene.add(inst)
}
