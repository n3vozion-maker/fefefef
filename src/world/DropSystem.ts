import * as THREE          from 'three'
import { bus }             from '../core/EventBus'
import { getTerrainHeight }from './TerrainNoise'
import type { CashSystem } from '../economy/CashSystem'

interface Drop {
  mesh:    THREE.Mesh
  pos:     THREE.Vector3
  vel:     THREE.Vector3
  settled: boolean
  type:    'cash' | 'ammo'
  value:   number
  timer:   number
}

const COLLECT_R  = 2.2
const LIFETIME   = 20     // s before despawn
const GRAVITY    = 20

const cashGeo = new THREE.SphereGeometry(0.20, 6, 4)
const cashMat = new THREE.MeshStandardMaterial({
  color: 0xffd700, metalness: 0.85, roughness: 0.15,
  emissive: 0xffaa00, emissiveIntensity: 0.4,
})

const ammoGeo = new THREE.BoxGeometry(0.26, 0.16, 0.36)
const ammoMat = new THREE.MeshStandardMaterial({
  color: 0x4caf50, metalness: 0.15, roughness: 0.75,
  emissive: 0x1a5c1a, emissiveIntensity: 0.25,
})

export class DropSystem {
  private drops: Drop[] = []

  constructor(private scene: THREE.Scene, private cash: CashSystem) {
    bus.on<{ position: THREE.Vector3 }>('agentDrops', (e) => {
      this.spawnAt(e.position)
    })
  }

  spawnAt(origin: THREE.Vector3): void {
    if (Math.random() < 0.85) this.spawnOne(origin, 'cash', 12 + Math.floor(Math.random() * 28))
    if (Math.random() < 0.52) this.spawnOne(origin, 'ammo', 6  + Math.floor(Math.random() * 10))
  }

  private spawnOne(origin: THREE.Vector3, type: 'cash' | 'ammo', value: number): void {
    const mesh = new THREE.Mesh(
      type === 'cash' ? cashGeo : ammoGeo,
      type === 'cash' ? cashMat : ammoMat,
    )
    mesh.position.copy(origin)
    mesh.castShadow = false
    this.scene.add(mesh)

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4.5,
      4.0 + Math.random() * 3.0,
      (Math.random() - 0.5) * 4.5,
    )
    this.drops.push({ mesh, pos: origin.clone(), vel, settled: false, type, value, timer: 0 })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const dead: Drop[] = []

    for (const d of this.drops) {
      d.timer += dt

      if (!d.settled) {
        d.vel.y -= GRAVITY * dt
        d.pos.addScaledVector(d.vel, dt)

        const ground = getTerrainHeight(d.pos.x, d.pos.z) + 0.18
        if (d.pos.y <= ground) {
          d.pos.y = ground
          d.vel.set(0, 0, 0)
          d.settled = true
        }
        d.mesh.rotation.x += d.vel.length() * dt
        d.mesh.rotation.z += d.vel.length() * dt * 0.7
        d.mesh.position.copy(d.pos)
      } else {
        // Gentle hover bob
        d.mesh.position.set(d.pos.x, d.pos.y + Math.sin(d.timer * 3.8) * 0.08, d.pos.z)
        d.mesh.rotation.y += dt * 2.2

        // Collect on proximity
        const dx = playerPos.x - d.pos.x
        const dz = playerPos.z - d.pos.z
        if (dx * dx + dz * dz < COLLECT_R * COLLECT_R) {
          this.collect(d)
          dead.push(d)
          continue
        }
      }

      if (d.timer >= LIFETIME) dead.push(d)
    }

    for (const d of dead) {
      this.scene.remove(d.mesh)
      this.drops = this.drops.filter(x => x !== d)
    }
  }

  private collect(d: Drop): void {
    if (d.type === 'cash') {
      this.cash.earn(d.value)
      bus.emit('dropPickup', 'cash')
    } else {
      bus.emit('ammoDropPickup', { amount: d.value })
      bus.emit('dropPickup', 'ammo')
    }
  }
}
