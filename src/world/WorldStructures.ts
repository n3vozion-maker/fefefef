import * as THREE  from 'three'
import * as CANNON from 'cannon-es'
import { getTerrainHeight }  from './TerrainNoise'
import type { PhysicsWorld } from '../physics/PhysicsWorld'

// ── Shared materials ──────────────────────────────────────────────────────────

const M = {
  concrete:  new THREE.MeshStandardMaterial({ color: 0x8c8c84, roughness: 0.95, metalness: 0 }),
  concreteD: new THREE.MeshStandardMaterial({ color: 0x555550, roughness: 0.95, metalness: 0 }),
  milGreen:  new THREE.MeshStandardMaterial({ color: 0x4a5c3a, roughness: 0.8,  metalness: 0.1 }),
  milGreenD: new THREE.MeshStandardMaterial({ color: 0x2e3d22, roughness: 0.85, metalness: 0.1 }),
  rust:      new THREE.MeshStandardMaterial({ color: 0x6e4c2a, roughness: 0.9,  metalness: 0.2 }),
  sandBag:   new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 1.0,  metalness: 0 }),
  wood:      new THREE.MeshStandardMaterial({ color: 0x7a5c2e, roughness: 0.9,  metalness: 0 }),
  stone:     new THREE.MeshStandardMaterial({ color: 0x857d6c, roughness: 1.0,  metalness: 0 }),
  ruinStone: new THREE.MeshStandardMaterial({ color: 0x6a6050, roughness: 1.0,  metalness: 0 }),
  metal:     new THREE.MeshStandardMaterial({ color: 0x505850, roughness: 0.5,  metalness: 0.6 }),
  metalRust: new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 0.75, metalness: 0.35 }),
  glass:     new THREE.MeshStandardMaterial({ color: 0x88aabb, roughness: 0.2,  metalness: 0.2, transparent: true, opacity: 0.45 }),
  corrMetal: new THREE.MeshStandardMaterial({ color: 0x607058, roughness: 0.7,  metalness: 0.4 }),
}

// ── Low-level builders ────────────────────────────────────────────────────────

function solidBox(
  scene:    THREE.Scene,
  physics:  PhysicsWorld | null,
  x: number, baseY: number, z: number,
  w: number, h: number, d: number,
  mat: THREE.Material,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, baseY + h * 0.5, z)
  if (rx || ry || rz) mesh.rotation.set(rx, ry, rz)
  mesh.castShadow    = true
  mesh.receiveShadow = true
  scene.add(mesh)

  if (physics) {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    const half = new CANNON.Vec3(w / 2, h / 2, d / 2)
    body.addShape(new CANNON.Box(half))
    if (rx || ry || rz) {
      const q = new CANNON.Quaternion()
      q.setFromEuler(rx, ry, rz)
      body.quaternion.copy(q)
    }
    body.position.set(x, baseY + h * 0.5, z)
    physics.addBody(body)
  }
  return mesh
}

function solidCyl(
  scene:   THREE.Scene,
  x: number, baseY: number, z: number,
  r: number, h: number,
  mat: THREE.Material, segs = 8,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), mat)
  mesh.position.set(x, baseY + h * 0.5, z)
  mesh.castShadow = true
  scene.add(mesh)
  return mesh
}

function decal(
  scene:  THREE.Scene,
  x: number, baseY: number, z: number,
  w: number, h: number, d: number,
  mat: THREE.Material,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set(x, baseY + h * 0.5, z)
  mesh.castShadow    = true
  mesh.receiveShadow = true
  scene.add(mesh)
}

// Convenience: height at world coords
const th = (x: number, z: number): number => getTerrainHeight(x, z)

// ── Reusable structure pieces ─────────────────────────────────────────────────

/** Solid wall segment. */
function wall(
  s: THREE.Scene, p: PhysicsWorld,
  x: number, z: number, length: number, height: number, thick: number,
  mat: THREE.Material, ry = 0,
): void {
  const by = th(x, z)
  solidBox(s, p, x, by, z, length, height, thick, mat, 0, ry, 0)
}

/** Guard tower: base pillar + elevated platform + roof */
function guardTower(
  s: THREE.Scene, p: PhysicsWorld,
  x: number, z: number, height = 7,
): void {
  const by = th(x, z)
  // Legs (4 thin pillars)
  for (const [dx, dz] of [[-0.7,-0.7],[-0.7,0.7],[0.7,-0.7],[0.7,0.7]] as [number,number][]) {
    solidBox(s, p, x + dx, by, z + dz, 0.25, height, 0.25, M.metal)
  }
  // Platform floor
  solidBox(s, p, x, by + height - 0.15, z, 3.2, 0.2, 3.2, M.metal)
  // Railings
  for (const [dx, dz, w, d] of [
    [0, -1.5, 3.0, 0.1], [0,  1.5, 3.0, 0.1],
    [-1.5, 0, 0.1, 3.0], [ 1.5, 0, 0.1, 3.0],
  ] as [number,number,number,number][]) {
    decal(s, x + dx, by + height, z + dz, w, 0.9, d, M.metal)
  }
  // Roof
  decal(s, x, by + height + 0.9, z, 3.6, 0.18, 3.6, M.corrMetal)
}

/** Barracks building: long box with corrugated roof stripe */
function barracks(
  s: THREE.Scene, p: PhysicsWorld,
  x: number, z: number, len: number, wid = 5, h = 3, ry = 0,
): void {
  const by = th(x, z)
  solidBox(s, p, x, by, z, len, h, wid, M.milGreen, 0, ry, 0)
  // Roof overhang strip
  decal(s, x, by + h + 0.06, z, len + 0.4, 0.18, wid + 0.4, M.corrMetal)
  // Door cutout illusion (dark rect on front face)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
  const off = ry === 0 ? new THREE.Vector3(0, 0, wid * 0.5 + 0.01) : new THREE.Vector3(len * 0.5 + 0.01, 0, 0)
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.05), doorMat)
  door.position.set(x + off.x, by + 1.05, z + off.z)
  s.add(door)
}

/** Sandbag wall row */
function sandbagWall(
  s: THREE.Scene,
  x: number, z: number, count: number, gap = 0.95, ry = 0,
): void {
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * gap
    const wx = x + (ry === 0 ? t : 0)
    const wz = z + (ry === 0 ? 0 : t)
    const by = th(wx, wz)
    // Two stacked bags per column, slightly offset
    const jitter = (i % 2) * 0.06
    decal(s, wx, by, wz + jitter, 0.88, 0.48, 0.46, M.sandBag)
    decal(s, wx, by + 0.48, wz - jitter, 0.82, 0.44, 0.42, M.sandBag)
  }
}

/** Stack of wooden crates */
function crateStack(
  s: THREE.Scene,
  x: number, z: number, cols: number, rows: number,
): void {
  const by = th(x, z)
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cx2 = x + c * 0.92
      const cz2 = z + (r % 2) * 0.08  // slight stagger
      const mat  = r % 3 === 0 ? M.milGreen : M.wood
      decal(s, cx2, by + r * 0.88, cz2, 0.85, 0.85, 0.85, mat)
    }
  }
}

/** Tall antenna / comms tower */
function antennaTower(
  s: THREE.Scene,
  x: number, z: number, height = 18,
): void {
  const by = th(x, z)
  solidCyl(s, x, by, z, 0.12, height, M.metal)
  // Cross-arms at intervals
  for (let i = 0; i < 3; i++) {
    const ay = by + height * 0.35 * (i + 1)
    decal(s, x, ay, z, 3.5 - i * 0.8, 0.1, 0.1, M.metal)
    decal(s, x, ay, z, 0.1, 0.1, 3.5 - i * 0.8, M.metal)
  }
  // Blinking light on top (emissive sphere)
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 1.2 }),
  )
  bulb.position.set(x, by + height + 0.25, z)
  s.add(bulb)
}

/** Radar dish on a pole */
function radarDish(
  s: THREE.Scene,
  x: number, z: number,
): void {
  const by = th(x, z)
  solidCyl(s, x, by, z, 0.1, 5, M.metal)
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 2.2, 0.35, 12), M.metal)
  dish.position.set(x, by + 5.4, z)
  dish.rotation.x = -Math.PI * 0.18
  s.add(dish)
}

/** Barrel / drum */
function barrel(s: THREE.Scene, x: number, z: number): void {
  const by = th(x, z)
  solidCyl(s, x, by, z, 0.32, 0.88, M.metalRust)
}

/** Concrete T-barrier (Jersey barrier) */
function jerseyBarrier(s: THREE.Scene, p: PhysicsWorld, x: number, z: number, ry = 0): void {
  const by = th(x, z)
  solidBox(s, p, x, by, z, 0.5, 1.0, 2.2, M.concrete, 0, ry, 0)
}

/** Broken wall segment — just a shorter, rougher wall piece */
function ruinWall(
  s: THREE.Scene,
  x: number, z: number, len: number, h: number, ry = 0,
): void {
  const by = th(x, z)
  solidBox(s, null, x, by, z, len, h, 0.55, M.ruinStone, 0, ry, 0)
}

/** Utility: quick 360° perimeter of wall segments */
function compound(
  s: THREE.Scene, p: PhysicsWorld,
  cx: number, cz: number,
  halfW: number, halfD: number,
  wallH = 2.2, wallT = 0.5,
  mat = M.concrete,
): void {
  // North
  wall(s, p, cx, cz - halfD, halfW * 2, wallH, wallT, mat, 0)
  // South
  wall(s, p, cx, cz + halfD, halfW * 2, wallH, wallT, mat, 0)
  // East
  wall(s, p, cx + halfW, cz, wallT, wallH, halfD * 2, mat, 0)
  // West
  wall(s, p, cx - halfW, cz, wallT, wallH, halfD * 2, mat, 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SITE BUILDERS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Firebase Alpha — mission_1 commander's base */
function buildFirebaseAlpha(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = 600, cz = -400

  // Perimeter walls
  compound(s, p, cx, cz, 26, 22, 2.4, 0.55, M.concrete)

  // Gate gap on south wall — override south with two halves
  const by_s = th(cx, cz + 22)
  solidBox(s, p, cx - 16, by_s, cz + 22, 14, 2.4, 0.55, M.concrete)
  solidBox(s, p, cx + 16, by_s, cz + 22, 14, 2.4, 0.55, M.concrete)

  // Guard towers — NW and NE corners
  guardTower(s, p, cx - 24, cz - 20, 7)
  guardTower(s, p, cx + 24, cz - 20, 7)

  // Barracks x3 (east side)
  barracks(s, p, cx + 12, cz - 6,  16, 5, 3)
  barracks(s, p, cx + 12, cz + 8,  14, 5, 3)
  barracks(s, p, cx - 12, cz + 8,  10, 4, 3)

  // Command building (centre-north)
  solidBox(s, p, cx, th(cx, cz - 10), cz - 10, 12, 4.5, 9, M.concreteD)
  decal(s, cx, th(cx, cz - 10) + 4.6, cz - 10, 12.4, 0.25, 9.4, M.corrMetal)
  // Windows (flat dark panels on command)
  for (const wz of [-12.5, -7.5]) {
    decal(s, cx + 6.08, th(cx, wz) + 2.5, wz, 0.08, 1.2, 1.8, M.glass)
    decal(s, cx - 6.08, th(cx, wz) + 2.5, wz, 0.08, 1.2, 1.8, M.glass)
  }

  // Sandbag positions (inside, facing gate)
  sandbagWall(s, cx - 8, cz + 16, 6, 0.95)
  sandbagWall(s, cx + 8, cz + 16, 6, 0.95)

  // Crate stacks
  crateStack(s, cx - 18, cz + 2, 3, 2)
  crateStack(s, cx - 18, cz - 4, 2, 3)
  crateStack(s, cx + 20, cz + 0, 2, 2)

  // Barrels
  for (const [bx, bz] of [[cx+6,cz+18],[cx-6,cz+18],[cx+16,cz-14],[cx-16,cz-14]] as [number,number][]) {
    barrel(s, bx, bz)
  }

  // Flagpole
  solidCyl(s, cx, th(cx, cz), cz, 0.08, 10, M.metal)
  // Flag (flat box)
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0x440000, emissiveIntensity: 0.4 })
  decal(s, cx + 1, th(cx, cz) + 9.6, cz, 2.4, 0.8, 0.05, flagMat)
}

/** Northern Ruins — mission_2 wraith territory */
function buildNorthernRuins(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = 200, cz = -1180

  // Ruined building shells (no roof)
  // Shell A — large
  ruinWall(s, cx - 8, cz - 6, 14, 3.5, 0)
  ruinWall(s, cx - 8, cz + 6, 14, 2.2, 0)
  // Left / right walls of shell A
  const byA = th(cx - 14, cz)
  solidBox(s, null, cx - 14, byA, cz, 0.55, 3.4, 12, M.ruinStone)
  solidBox(s, null, cx - 2,  byA, cz, 0.55, 2.0, 12, M.ruinStone)  // partial east wall

  // Shell B — smaller, rotated
  const byB = th(cx + 12, cz - 4)
  solidBox(s, null, cx + 12,  byB, cz - 4, 8,   3.0, 0.55, M.stone)
  solidBox(s, null, cx + 12,  byB, cz + 3, 6,   1.6, 0.55, M.ruinStone)  // broken south
  solidBox(s, null, cx + 8.5, byB, cz,     0.55, 3.0, 7,   M.stone)
  solidBox(s, null, cx + 15.5,byB, cz,     0.55, 2.2, 7,   M.ruinStone)

  // Shell C — corner ruin
  const byC = th(cx - 4, cz + 14)
  solidBox(s, null, cx - 4, byC, cz + 11, 9,   2.8, 0.5, M.stone)
  solidBox(s, null, cx - 8, byC, cz + 14, 0.5, 2.8, 7,   M.stone)

  // Rubble piles
  for (const [rx, rz, rh] of [
    [cx + 4, cz + 2, 0.8], [cx - 6, cz + 8, 0.6],
    [cx + 18, cz - 10, 0.7], [cx + 8, cz + 8, 0.5],
    [cx - 10, cz - 12, 0.65],
  ] as [number,number,number][]) {
    const rb = th(rx, rz)
    decal(s, rx, rb, rz, 2.0, rh, 1.8, M.ruinStone)
    decal(s, rx + 0.5, rb + rh * 0.4, rz - 0.3, 1.4, rh * 0.55, 1.2, M.stone)
  }

  // Bunker entrance: concrete box + ramp
  const bx = cx + 2, bz = cz - 16
  const byBunk = th(bx, bz)
  solidBox(s, p, bx, byBunk, bz, 8, 3.5, 6, M.concreteD)
  // Ramp (angled box in front)
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 4), M.concreteD)
  rampMesh.position.set(bx, byBunk + 0.2, bz + 5)
  rampMesh.rotation.x = 0.22
  rampMesh.castShadow = true
  s.add(rampMesh)
  // Blast door
  solidBox(s, null, bx, byBunk + 1.3, bz - 3.0, 3.2, 2.6, 0.2, M.metal)

  // Small signal repeater (SQ2 tower)
  antennaTower(s, cx + 20, cz + 6, 12)

  // Sandbag ring outside bunker
  sandbagWall(s, bx - 5, bz + 8, 5, 0.95)
  sandbagWall(s, bx + 5, bz + 8, 5, 0.95)
}

/** Firebase Bravo — mission_3 heavy unit base */
function buildFirebaseBravo(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = -680, cz = 820

  // Heavier, taller perimeter
  compound(s, p, cx, cz, 32, 28, 3.2, 0.7, M.concreteD)

  // Gate gap south
  const by_s = th(cx, cz + 28)
  solidBox(s, p, cx - 20, by_s, cz + 28, 20, 3.2, 0.7, M.concreteD)
  solidBox(s, p, cx + 20, by_s, cz + 28, 20, 3.2, 0.7, M.concreteD)

  // 4 guard towers at all corners
  guardTower(s, p, cx - 30, cz - 26, 9)
  guardTower(s, p, cx + 30, cz - 26, 9)
  guardTower(s, p, cx - 30, cz + 26, 8)
  guardTower(s, p, cx + 30, cz + 26, 8)

  // Vehicle depot (open canopy on north side)
  const vby = th(cx, cz - 18)
  solidBox(s, p, cx - 10, vby, cz - 18, 18, 0.3, 14, M.corrMetal)  // roof slab
  // Support pillars
  for (const [dpx, dpz] of [[-8,-10],[-8,-26],[8,-10],[8,-26]] as [number,number][]) {
    solidBox(s, p, cx + dpx, th(cx+dpx, cz+dpz), cz + dpz, 0.4, 4.8, 0.4, M.metal)
  }

  // Main command building
  solidBox(s, p, cx + 8, th(cx+8,cz+4), cz + 4, 16, 5, 10, M.concreteD)
  decal(s, cx + 8, th(cx+8, cz+4) + 5.1, cz + 4, 16.6, 0.3, 10.6, M.corrMetal)

  // Secondary barracks
  barracks(s, p, cx - 16, cz + 8, 14, 5, 3.5)
  barracks(s, p, cx - 14, cz + 18, 12, 5, 3.0)

  // Radar dish
  radarDish(s, cx + 22, cz - 24)

  // Sandbag positions
  sandbagWall(s, cx - 10, cz + 24, 8)
  sandbagWall(s, cx + 10, cz + 24, 8)
  sandbagWall(s, cx,      cz - 24, 10)

  // Crates / barrels
  crateStack(s, cx - 24, cz + 4, 3, 3)
  crateStack(s, cx + 22, cz + 12, 2, 2)
  for (const [bx, bz] of [
    [cx-22,cz-8],[cx-20,cz+0],[cx+26,cz-10],[cx+24,cz-4],
  ] as [number,number][]) {
    barrel(s, bx, bz)
  }

  // Antenna tower inside
  antennaTower(s, cx - 26, cz - 10, 20)
}

/** Dead Drop / Phantom outpost — mission_4 */
function buildDeadDrop(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = 750, cz = 420

  // Partial perimeter (outpost, not fully walled)
  wall(s, p, cx, cz - 16, 36, 2.0, 0.5, M.corrMetal)       // north
  wall(s, p, cx - 18, cz - 4, 0.5, 2.0, 24, M.corrMetal)   // west
  // East wall has gap for entrance
  solidBox(s, p, cx + 18, th(cx+18,cz+4), cz + 4, 0.5, 2.0, 18, M.corrMetal)

  // Prefab outpost buildings
  barracks(s, p, cx - 8, cz - 8, 10, 4.5, 2.8)
  barracks(s, p, cx + 6, cz + 4,  8, 4, 2.6, Math.PI * 0.5)

  // Comms tower
  antennaTower(s, cx + 14, cz - 12, 20)

  // Crashed helicopter approximation
  const hby = th(cx - 4, cz + 14)
  // Fuselage
  solidBox(s, null, cx - 4, hby, cz + 14, 10, 1.8, 2.2, M.metalRust, 0, 0.3, 0.12)
  // Tail boom
  solidBox(s, null, cx + 6, hby + 0.6, cz + 14.5, 6, 0.7, 0.9, M.metalRust, 0, 0.28, 0)
  // Main rotor (flat X)
  decal(s, cx - 4, hby + 1.8, cz + 14, 8, 0.12, 0.55, M.metal)
  decal(s, cx - 4, hby + 1.8, cz + 14, 0.55, 0.12, 8, M.metal)
  // Skids
  decal(s, cx - 7, hby + 0.05, cz + 13, 5, 0.15, 0.2, M.metal)
  decal(s, cx - 7, hby + 0.05, cz + 15, 5, 0.15, 0.2, M.metal)

  // Sandbag nests
  sandbagWall(s, cx - 14, cz + 4, 5)
  sandbagWall(s, cx + 12, cz - 6, 5)
  sandbagWall(s, cx + 6,  cz - 14, 6)

  // Crates and supply boxes
  crateStack(s, cx - 14, cz - 10, 3, 2)
  crateStack(s, cx + 14, cz + 8,  2, 3)
  for (const [bx, bz] of [[cx-10,cz+8],[cx+2,cz+16],[cx+10,cz-14]] as [number,number][]) {
    barrel(s, bx, bz)
  }
}

/** Deep Facility — mission_5 General Rex's bunker complex */
function buildDeepFacility(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = -850, cz = -700

  // Outer security ring (concrete, tallest in game)
  compound(s, p, cx, cz, 38, 30, 4.0, 0.8, M.concreteD)

  // Gate south
  const by_sg = th(cx, cz + 30)
  solidBox(s, p, cx - 22, by_sg, cz + 30, 28, 4.0, 0.8, M.concreteD)
  solidBox(s, p, cx + 22, by_sg, cz + 30, 28, 4.0, 0.8, M.concreteD)

  // Gate towers
  guardTower(s, p, cx - 8, cz + 30, 8)
  guardTower(s, p, cx + 8, cz + 30, 8)

  // Corner watchtowers
  guardTower(s, p, cx - 36, cz - 28, 11)
  guardTower(s, p, cx + 36, cz - 28, 11)
  guardTower(s, p, cx - 36, cz + 28, 9)
  guardTower(s, p, cx + 36, cz + 28, 9)

  // Main bunker building (large, imposing)
  const mby = th(cx, cz - 10)
  solidBox(s, p, cx, mby, cz - 10, 28, 7, 18, M.concreteD)
  decal(s, cx, mby + 7.15, cz - 10, 28.6, 0.4, 18.6, M.metal)
  // Bunker entrance ramp
  const ramp2 = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), M.concreteD)
  ramp2.position.set(cx, mby + 0.5, cz + 0)
  ramp2.rotation.x = -0.28
  ramp2.castShadow = true
  s.add(ramp2)
  // Heavy blast doors
  solidBox(s, null, cx, mby + 2.8, cz - 1.2, 7.5, 4.8, 0.3, M.metal)

  // Secondary operations building
  solidBox(s, p, cx + 20, th(cx+20,cz+8), cz + 8, 14, 4.5, 10, M.concreteD)

  // Power generators (N wall)
  for (let i = -1; i <= 1; i++) {
    const gx = cx + i * 10, gz = cz - 24
    solidBox(s, null, gx, th(gx,gz), gz, 3.5, 2.2, 2.5, M.metal)
    // Exhaust pipe
    solidCyl(s, gx + 1.2, th(gx,gz) + 2.2, gz, 0.18, 1.5, M.metal)
  }

  // Ventilation shafts
  for (const [vx, vz] of [
    [cx-28,cz-18],[cx+28,cz-18],[cx-28,cz+4],[cx+28,cz+4],
  ] as [number,number][]) {
    solidBox(s, null, vx, th(vx,vz), vz, 1.2, 3.5, 1.2, M.concreteD)
    // Grate on top
    decal(s, vx, th(vx,vz) + 3.6, vz, 1.4, 0.12, 1.4, M.metal)
  }

  // Sandbag defensive rings
  sandbagWall(s, cx - 12, cz + 22, 8)
  sandbagWall(s, cx + 12, cz + 22, 8)
  sandbagWall(s, cx,      cz + 14, 10)

  // Crates and drums
  crateStack(s, cx - 28, cz + 14, 4, 3)
  crateStack(s, cx + 28, cz + 14, 3, 3)
  for (const [bx, bz] of [
    [cx-22,cz+10],[cx-20,cz+4],[cx+22,cz+6],[cx+18,cz+14],
  ] as [number,number][]) {
    barrel(s, bx, bz)
  }

  // Tall antenna cluster
  antennaTower(s, cx - 32, cz - 6, 24)
  antennaTower(s, cx + 32, cz - 6, 18)
}

// ─────────────────────────────────────────────────────────────────────────────
// Side quest sites
// ─────────────────────────────────────────────────────────────────────────────

/** SQ1: Cache drop site near Outpost West */
function buildSQ1CacheSite(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = -920, cz = -220
  // Guard shack
  solidBox(s, p, cx + 4, th(cx+4,cz), cz, 4, 2.5, 4, M.corrMetal)
  decal(s, cx + 4, th(cx+4,cz) + 2.6, cz, 4.4, 0.2, 4.4, M.corrMetal)
  // Sandbag ring (half-circle facing south)
  sandbagWall(s, cx - 4, cz + 3, 6)
  sandbagWall(s, cx - 4, cz - 3, 4)
  // Crate stack (the cache)
  crateStack(s, cx - 8, cz, 3, 3)
  crateStack(s, cx - 12, cz + 2, 2, 2)
  // Barrels
  barrel(s, cx + 8, cz + 4)
  barrel(s, cx + 6, cz - 2)
}

/** SQ3: Sniper ridge near Outpost East */
function buildSQ3SniperRidge(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = 1060, cz = 140
  // Tall watchtower (sniper nest)
  guardTower(s, p, cx, cz, 10)
  // Sandbag ring around base
  sandbagWall(s, cx, cz + 5, 7)
  sandbagWall(s, cx, cz - 5, 7)
  // Small ammo shack
  solidBox(s, p, cx + 10, th(cx+10,cz), cz - 6, 4, 2.4, 4, M.wood)
  crateStack(s, cx - 8, cz + 2, 2, 2)
  barrel(s, cx + 12, cz)
  barrel(s, cx + 14, cz - 4)
}

/** SQ4: Weapons depot in southern marsh */
function buildSQ4Depot(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = -505, cz = -800
  // Warehouse
  solidBox(s, p, cx, th(cx,cz), cz, 18, 5, 10, M.corrMetal)
  decal(s, cx, th(cx,cz) + 5.1, cz, 18.6, 0.3, 10.6, M.metal)
  // Security fence posts (N side)
  for (let i = -4; i <= 4; i++) {
    solidBox(s, null, cx + i * 4, th(cx+i*4, cz-8), cz - 8, 0.15, 2.2, 0.15, M.metal)
  }
  // Fence rail
  decal(s, cx, th(cx, cz-8) + 1.8, cz - 8, 32, 0.12, 0.1, M.metal)
  // Container stacks
  for (const [ox, oz, col] of [
    [8, -4, 0x2255aa], [-8, -4, 0xcc4411], [8, 4, 0x336622],
  ] as [number,number,number][]) {
    const cmat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.3 })
    const by = th(cx+ox, cz+oz)
    solidBox(s, p, cx+ox, by, cz+oz, 6, 2.8, 2.4, cmat)
    solidBox(s, p, cx+ox, by+2.8, cz+oz, 6, 2.8, 2.4, cmat)
  }
  // Guard station
  solidBox(s, p, cx - 14, th(cx-14,cz-6), cz - 6, 3.5, 2.6, 3.5, M.concreteD)
  sandbagWall(s, cx - 10, cz + 6, 6)
  crateStack(s, cx + 16, cz + 2, 2, 3)
}

/** SQ5: Convoy ambush point — central sector */
function buildSQ5ConvoyPoint(s: THREE.Scene, p: PhysicsWorld): void {
  const cx = 400, cz = 310
  // Jersey barrier roadblock row
  for (let i = -3; i <= 3; i++) {
    jerseyBarrier(s, p, cx + i * 2.6, cz - 6, 0)
    jerseyBarrier(s, p, cx + i * 2.6, cz + 6, 0)
  }
  // Abandoned supply truck approximation (boxes)
  const tby = th(cx - 14, cz)
  solidBox(s, null, cx - 14, tby, cz, 5.5, 2.5, 2.2, M.milGreenD)  // cab
  solidBox(s, null, cx - 9,  tby, cz, 7,   2.8, 2.3, M.corrMetal)  // cargo bed
  // Wheels (cylinders)
  for (const [wx, wz] of [[-17,-1],[-17,1],[-12,-1],[-12,1],[-7,-1],[-7,1]] as [number,number][]) {
    solidCyl(s, cx+wx, tby, cz+wz, 0.55, 0.3, M.metal, 6)
  }
  // Scattered cover crates
  crateStack(s, cx + 4, cz - 2, 2, 2)
  crateStack(s, cx + 8, cz + 4, 2, 3)
  crateStack(s, cx - 2, cz + 8, 3, 2)
  // Sandbag positions
  sandbagWall(s, cx - 2, cz + 12, 5)
  sandbagWall(s, cx + 6, cz - 12, 5)
  // Barrels
  for (const [bx, bz] of [[cx+12,cz-4],[cx-18,cz+6],[cx+14,cz+8]] as [number,number][]) {
    barrel(s, bx, bz)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── PUBLIC ENTRY POINT ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function buildAllStructures(scene: THREE.Scene, physics: PhysicsWorld): void {
  // Main mission sites
  buildFirebaseAlpha(scene, physics)
  buildNorthernRuins(scene, physics)
  buildFirebaseBravo(scene, physics)
  buildDeadDrop(scene, physics)
  buildDeepFacility(scene, physics)

  // Side quest sites
  buildSQ1CacheSite(scene, physics)
  buildSQ3SniperRidge(scene, physics)
  buildSQ4Depot(scene, physics)
  buildSQ5ConvoyPoint(scene, physics)
}
