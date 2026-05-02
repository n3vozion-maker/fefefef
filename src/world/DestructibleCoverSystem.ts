import * as THREE  from 'three'
import * as CANNON from 'cannon-es'
import { bus }              from '../core/EventBus'
import { getTerrainHeight } from './TerrainNoise'
import type { PhysicsWorld } from '../physics/PhysicsWorld'

// ── Destructible cover pieces ─────────────────────────────────────────────────
// Wooden crates (80 hp) and sandbag clusters (200 hp) placed near POIs.
// Each piece has a physics body tagged with `coverId`.
// On destruction: physics body removed, mesh swapped to rubble, debris bursts.

const CRATE_HP   = 80
const SANDBAG_HP = 200

type CoverType = 'crate' | 'sandbag'

interface CoverPiece {
  id:      string
  type:    CoverType
  mesh:    THREE.Object3D
  body:    CANNON.Body
  hp:      number
  maxHp:   number
  alive:   boolean
  pos:     THREE.Vector3
}

// Debris particles after destruction
interface Debris {
  mesh:  THREE.Mesh
  vel:   THREE.Vector3
  rot:   THREE.Vector3
  life:  number
}

// ── Spawn sites: [x, z, type, rotY] ──────────────────────────────────────────
// Placed around bases, the village, and the mid-map camp.

type Site = [number, number, CoverType, number]   // x, z, type, rotY

const COVER_SITES: Site[] = [
  // Firebase Alpha (580, -380)
  [ 572, -368, 'sandbag', 0         ],
  [ 590, -368, 'sandbag', 0         ],
  [ 566, -388, 'crate',   0         ],
  [ 594, -388, 'crate',   0         ],
  [ 578, -396, 'crate',   Math.PI/4 ],

  // Firebase Bravo (-680, 820)
  [-688,  832, 'sandbag', 0         ],
  [-672,  832, 'sandbag', 0         ],
  [-694,  812, 'crate',   0         ],
  [-666,  812, 'crate',   Math.PI/3 ],

  // Village North (210, -1180)
  [ 202,-1172, 'sandbag', Math.PI/2 ],
  [ 218,-1172, 'sandbag', Math.PI/2 ],
  [ 210,-1188, 'crate',   0         ],
  [ 220,-1188, 'crate',   Math.PI/6 ],

  // Outpost East (1080, 120)
  [1072,  112, 'sandbag', 0         ],
  [1088,  112, 'sandbag', 0         ],
  [1076,  128, 'crate',   0         ],

  // Outpost West (-890, -180)
  [-898, -172, 'sandbag', Math.PI/2 ],
  [-882, -172, 'sandbag', Math.PI/2 ],
  [-890, -188, 'crate',   Math.PI/4 ],

  // Mid-map camp (410, 310)
  [ 402,  318, 'crate',   0         ],
  [ 418,  318, 'crate',   Math.PI/5 ],
  [ 410,  304, 'sandbag', 0         ],

  // Player spawn area (0, 0)
  [  -8,    8, 'sandbag', Math.PI/2 ],
  [   8,    8, 'sandbag', Math.PI/2 ],
  [  -8,   -8, 'crate',   0         ],
  [   8,   -8, 'crate',   Math.PI/4 ],
]

// ── Materials ─────────────────────────────────────────────────────────────────

const matCrate    = new THREE.MeshStandardMaterial({ color: 0x7a5c2e, roughness: 0.90, metalness: 0 })
const matCrateDmg = new THREE.MeshStandardMaterial({ color: 0x5a3c18, roughness: 0.95, metalness: 0 })
const matSandbag  = new THREE.MeshStandardMaterial({ color: 0xc4a06a, roughness: 1.00, metalness: 0 })
const matDebris   = new THREE.MeshStandardMaterial({ color: 0x6a4a1e, roughness: 0.95, metalness: 0 })
const matDust     = new THREE.MeshBasicMaterial({ color: 0xbba880, transparent: true, depthWrite: false })

let _nextId = 1

export class DestructibleCoverSystem {
  private pieces = new Map<string, CoverPiece>()
  private debris: Debris[] = []

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    this.buildAll()

    bus.on<{ coverId: string; position: THREE.Vector3; damage: number }>(
      'coverHit',
      (e) => this.applyDamage(e.coverId, e.damage, e.position),
    )

    // Blast damage also breaks cover
    bus.on<{ position: THREE.Vector3; radius: number; damage: number }>(
      'blastDamage',
      (e) => {
        for (const piece of this.pieces.values()) {
          if (!piece.alive) continue
          if (piece.pos.distanceTo(e.position) < e.radius) {
            this.applyDamage(piece.id, e.damage, e.position)
          }
        }
      },
    )
  }

  update(dt: number): void {
    for (const d of this.debris) {
      d.life -= dt
      d.mesh.position.addScaledVector(d.vel, dt)
      d.vel.y -= 12 * dt               // gravity
      d.vel.multiplyScalar(1 - 3 * dt) // drag
      d.mesh.rotation.x += d.rot.x * dt
      d.mesh.rotation.z += d.rot.z * dt
      if (d.life < 0.35) {
        ;(d.mesh.material as THREE.MeshBasicMaterial).opacity = d.life / 0.35
      }
    }
    const dead = this.debris.filter(d => d.life <= 0)
    for (const d of dead) this.scene.remove(d.mesh)
    this.debris = this.debris.filter(d => d.life > 0)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildAll(): void {
    for (const [x, z, type, ry] of COVER_SITES) {
      this.spawnPiece(x, z, type, ry)
    }
  }

  private spawnPiece(x: number, z: number, type: CoverType, rotY: number): void {
    const id  = `cover_${_nextId++}`
    const y   = getTerrainHeight(x, z)
    const pos = new THREE.Vector3(x, y, z)

    const { mesh, hw, hh, hd } = type === 'crate'
      ? this.buildCrateMesh(pos, rotY)
      : this.buildSandbagMesh(pos, rotY)

    // Physics body
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    body.addShape(new CANNON.Box(new CANNON.Vec3(hw, hh, hd)))
    body.position.set(x, y + hh, z)
    if (rotY) {
      const q = new CANNON.Quaternion(); q.setFromEuler(0, rotY, 0)
      body.quaternion.copy(q)
    }
    ;(body as unknown as Record<string, unknown>)['coverId'] = id
    this.physics.addBody(body)

    const piece: CoverPiece = {
      id, type, mesh, body, pos,
      hp:    type === 'crate' ? CRATE_HP : SANDBAG_HP,
      maxHp: type === 'crate' ? CRATE_HP : SANDBAG_HP,
      alive: true,
    }
    this.pieces.set(id, piece)
  }

  private buildCrateMesh(pos: THREE.Vector3, ry: number): { mesh: THREE.Object3D; hw: number; hh: number; hd: number } {
    const hw = 0.42; const hh = 0.42; const hd = 0.42
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, hh * 2, hd * 2), matCrate.clone())
    mesh.position.set(pos.x, pos.y + hh, pos.z)
    mesh.rotation.y = ry
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)
    return { mesh, hw, hh, hd }
  }

  private buildSandbagMesh(pos: THREE.Vector3, ry: number): { mesh: THREE.Object3D; hw: number; hh: number; hd: number } {
    const group = new THREE.Group()
    group.position.set(pos.x, pos.y, pos.z)
    group.rotation.y = ry

    // Bottom row of 3 bags
    for (let i = -1; i <= 1; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.44, 0.42), matSandbag.clone())
      bag.position.set(i * 0.88, 0.22, 0)
      bag.rotation.y = (i % 2) * 0.06
      bag.castShadow = true
      group.add(bag)
    }
    // Top row of 2 bags (offset)
    for (const ox of [-0.44, 0.44]) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.40, 0.38), matSandbag.clone())
      bag.position.set(ox, 0.66, 0)
      bag.castShadow = true
      group.add(bag)
    }
    this.scene.add(group)

    // Sandbag cluster half-extents
    const hw = 1.36; const hh = 0.48; const hd = 0.22
    return { mesh: group, hw, hh, hd }
  }

  private applyDamage(id: string, dmg: number, hitPos: THREE.Vector3): void {
    const piece = this.pieces.get(id)
    if (!piece?.alive) return

    piece.hp -= dmg
    this.showDamageState(piece)

    if (piece.hp <= 0) this.destroy(piece, hitPos)
  }

  private showDamageState(piece: CoverPiece): void {
    if (piece.type !== 'crate') return
    const mesh = piece.mesh as THREE.Mesh
    if (!mesh.material) return
    const frac = piece.hp / piece.maxHp
    if (frac < 0.5) {
      // Darken crate to show damage
      ;(mesh.material as THREE.MeshStandardMaterial).color.copy(matCrateDmg.color)
    }
  }

  private destroy(piece: CoverPiece, hitPos: THREE.Vector3): void {
    piece.alive = false

    // Remove physics body so bullets pass through
    this.physics.removeBody(piece.body)

    // Remove intact mesh
    this.scene.remove(piece.mesh)

    // Spawn rubble pile
    this.spawnRubble(piece)

    // Debris burst
    this.spawnDebris(hitPos, piece.type)

    bus.emit('hudNotify', piece.type === 'crate' ? 'Cover destroyed' : 'Sandbags breached')
    bus.emit('bulletImpact', { position: hitPos })
  }

  private spawnRubble(piece: CoverPiece): void {
    const pos = piece.pos.clone()
    if (piece.type === 'crate') {
      // Scattered planks
      const plankGeo = new THREE.BoxGeometry(0.7, 0.07, 0.18)
      for (let i = 0; i < 5; i++) {
        const mesh = new THREE.Mesh(plankGeo, matCrate)
        mesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.9,
          pos.y + 0.04,
          pos.z + (Math.random() - 0.5) * 0.9,
        )
        mesh.rotation.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.4,
        )
        mesh.receiveShadow = true
        this.scene.add(mesh)
      }
    } else {
      // Flat scattered bags
      for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.84 + Math.random() * 0.2, 0.12, 0.42),
          matSandbag,
        )
        mesh.position.set(
          pos.x + (Math.random() - 0.5) * 1.5,
          pos.y + 0.06,
          pos.z + (Math.random() - 0.5) * 0.6,
        )
        mesh.rotation.y = Math.random() * Math.PI
        mesh.receiveShadow = true
        this.scene.add(mesh)
      }
    }
  }

  private spawnDebris(hitPos: THREE.Vector3, type: CoverType): void {
    const COUNT = type === 'crate' ? 8 : 6
    const geo   = type === 'crate'
      ? new THREE.BoxGeometry(0.12, 0.06, 0.08)
      : new THREE.BoxGeometry(0.15, 0.08, 0.10)

    for (let i = 0; i < COUNT; i++) {
      const mat  = type === 'crate' ? matDebris.clone() : matDust.clone()
      mat.transparent = true
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(hitPos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.4,
        (Math.random() - 0.5) * 0.5,
      ))
      this.scene.add(mesh)

      this.debris.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          2 + Math.random() * 4,
          (Math.random() - 0.5) * 5,
        ),
        rot: new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8),
        life: 0.8 + Math.random() * 0.6,
      })
    }
  }
}
