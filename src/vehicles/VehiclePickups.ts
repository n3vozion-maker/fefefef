import * as THREE from 'three'
import { bus }    from '../core/EventBus'
import type { ConsumableInventory } from '../player/ConsumableInventory'

// ── Constants ─────────────────────────────────────────────────────────────────

const PICKUP_R     = 2.8
const RESPAWN_TIME = 90
const BOB_AMP      = 0.22
const BOB_FREQ     = 1.5
const SPIN_RATE    = 0.7

// ── VehiclePickup ─────────────────────────────────────────────────────────────

type PickupKind = 'repair' | 'fuel'

class VehiclePickup {
  private mesh:        THREE.Group
  private active       = true
  private respawnTimer = 0
  private bobT:        number

  constructor(
    private pos:   THREE.Vector3,
    private kind:  PickupKind,
    private scene: THREE.Scene,
  ) {
    this.bobT = Math.random() * Math.PI * 2
    this.mesh = this.build()
    scene.add(this.mesh)
  }

  private build(): THREE.Group {
    const g   = new THREE.Group()
    const col = this.kind === 'repair' ? 0x4caf50 : 0xff9800
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.3 })

    if (this.kind === 'fuel') {
      // Fuel canister — cylinder
      const can  = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 10), mat)
      const cap  = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 }))
      cap.position.y = 0.32
      g.add(can, cap)
    } else {
      // Repair kit — box with cross
      const box  = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), mat)
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffffff }))
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.32),
        new THREE.MeshBasicMaterial({ color: 0xffffff }))
      hBar.position.y = 0.17; vBar.position.y = 0.17
      g.add(box, hBar, vBar)
    }

    // Glow ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.035, 4, 16),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.2
    g.add(ring)

    g.position.copy(this.pos)
    return g
  }

  update(dt: number, playerPos: THREE.Vector3, inv: ConsumableInventory): void {
    if (!this.active) {
      this.respawnTimer -= dt
      if (this.respawnTimer <= 0) {
        this.active = true
        this.scene.add(this.mesh)
      }
      return
    }

    this.bobT += dt * BOB_FREQ
    this.mesh.position.y  = this.pos.y + Math.sin(this.bobT) * BOB_AMP
    this.mesh.rotation.y += SPIN_RATE * dt

    if (this.mesh.position.distanceTo(playerPos) < PICKUP_R) {
      this.collect(inv)
    }
  }

  private collect(inv: ConsumableInventory): void {
    this.active        = false
    this.respawnTimer  = RESPAWN_TIME
    this.scene.remove(this.mesh)

    if (this.kind === 'repair') {
      inv.addRepairKit()
      bus.emit('hudNotify', { msg: '🔧 Repair Kit', color: '#4caf50' })
    } else {
      inv.addFuelCanister()
      bus.emit('hudNotify', { msg: '⛽ Fuel Canister', color: '#ff9800' })
    }
  }

  dispose(): void { this.scene.remove(this.mesh) }
}

// ── VehiclePickupSystem ───────────────────────────────────────────────────────

export class VehiclePickupSystem {
  private pickups: VehiclePickup[] = []

  constructor(private scene: THREE.Scene) {}

  spawn(x: number, y: number, z: number, kind: PickupKind): void {
    this.pickups.push(new VehiclePickup(new THREE.Vector3(x, y, z), kind, this.scene))
  }

  spawnCluster(cx: number, cy: number, cz: number): void {
    const offsets: [number, number, PickupKind][] = [
      [-3,  3, 'fuel'],
      [ 3,  3, 'repair'],
      [-3, -3, 'fuel'],
      [ 3, -3, 'repair'],
    ]
    for (const [dx, dz, kind] of offsets) {
      this.spawn(cx + dx, cy, cz + dz, kind)
    }
  }

  update(dt: number, playerPos: THREE.Vector3, inv: ConsumableInventory): void {
    for (const p of this.pickups) p.update(dt, playerPos, inv)
  }

  dispose(): void {
    for (const p of this.pickups) p.dispose()
    this.pickups.length = 0
  }
}
