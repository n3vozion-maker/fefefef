import * as THREE from 'three'
import { bus }    from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const PICKUP_R      = 2.5    // metres — proximity trigger
const RESPAWN_TIME  = 45     // seconds
const BOB_AMP       = 0.25
const BOB_FREQ      = 1.8
const SPIN_RATE     = 0.9

// ── Ammo types ────────────────────────────────────────────────────────────────

export type AmmoType = 'rifle' | 'pistol' | 'sniper' | 'explosive'

const AMMO_AMOUNTS: Record<AmmoType, number> = {
  rifle:     60,
  pistol:    30,
  sniper:    10,
  explosive:  3,
}

const AMMO_COLORS: Record<AmmoType, number> = {
  rifle:     0x44aaff,
  pistol:    0x44ff88,
  sniper:    0xffaa22,
  explosive: 0xff4422,
}

// ── AmmoPickup ────────────────────────────────────────────────────────────────

export class AmmoPickup {
  private mesh:        THREE.Group
  private active       = true
  private respawnTimer = 0
  private bobT:        number

  constructor(
    private pos:   THREE.Vector3,
    private type:  AmmoType,
    private scene: THREE.Scene,
  ) {
    this.bobT = Math.random() * Math.PI * 2
    this.mesh = this.buildMesh()
    scene.add(this.mesh)
  }

  private buildMesh(): THREE.Group {
    const color = AMMO_COLORS[this.type]
    const g     = new THREE.Group()

    // Ammo box body
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.35, 0.7),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }),
    )
    box.castShadow = true

    // Label stripe
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.12, 0.71),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    stripe.position.y = 0.06

    // Glow ring underneath
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 4, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.25

    g.add(box, stripe, ring)
    g.position.copy(this.pos)
    return g
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.active) {
      this.respawnTimer -= dt
      if (this.respawnTimer <= 0) {
        this.active = true
        this.mesh.visible = true
        this.scene.add(this.mesh)
      }
      return
    }

    this.bobT += dt * BOB_FREQ
    this.mesh.position.y   = this.pos.y + Math.sin(this.bobT) * BOB_AMP
    this.mesh.rotation.y  += SPIN_RATE * dt

    const dist = this.mesh.position.distanceTo(playerPos)
    if (dist < PICKUP_R) {
      this.collect()
    }
  }

  private collect(): void {
    this.active        = false
    this.respawnTimer  = RESPAWN_TIME
    this.mesh.visible  = false

    bus.emit('ammoPickup', {
      type:   this.type,
      amount: AMMO_AMOUNTS[this.type],
    })
  }

  dispose(): void {
    this.scene.remove(this.mesh)
  }
}

// ── AmmoPickupSystem ──────────────────────────────────────────────────────────

export class AmmoPickupSystem {
  private pickups: AmmoPickup[] = []

  constructor(private scene: THREE.Scene) {}

  /** Scatter ammo crates around a world position (e.g. a POI) */
  spawnCluster(cx: number, cy: number, cz: number, count = 4): void {
    const types: AmmoType[] = ['rifle', 'pistol', 'sniper', 'explosive']
    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2
      const radius = 4 + Math.random() * 3
      const x      = cx + Math.cos(angle) * radius
      const z      = cz + Math.sin(angle) * radius
      const type: AmmoType = types[i % types.length] ?? 'rifle'
      this.pickups.push(new AmmoPickup(new THREE.Vector3(x, cy, z), type, this.scene))
    }
  }

  /** Spawn a single crate of a given type */
  spawn(x: number, y: number, z: number, type: AmmoType): void {
    this.pickups.push(new AmmoPickup(new THREE.Vector3(x, y, z), type, this.scene))
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    for (const p of this.pickups) p.update(dt, playerPos)
  }

  dispose(): void {
    for (const p of this.pickups) p.dispose()
    this.pickups.length = 0
  }
}
