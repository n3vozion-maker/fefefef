import * as THREE from 'three'
import { bus }    from '../core/EventBus'

// ── BloodSystem ───────────────────────────────────────────────────────────────
// Spawns red blood particles at enemy hit positions.
// Each hit: 8-14 small spheres fly outward, drop with gravity, fade out.

const GRAVITY     = -14       // m/s² downward
const LIFETIME    = 0.55      // seconds
const SPEED_MIN   = 3
const SPEED_MAX   = 9
const DROP_RADIUS = 0.08      // sphere size
const MAX_ACTIVE  = 320       // hard cap on live particles

interface Drop {
  mesh:  THREE.Mesh
  vel:   THREE.Vector3
  life:  number
  total: number
}

export class BloodSystem {
  private drops:   Drop[] = []
  private geo      = new THREE.SphereGeometry(DROP_RADIUS, 4, 4)
  private mat      = new THREE.MeshBasicMaterial({ color: 0xaa0000 })
  private darkMat  = new THREE.MeshBasicMaterial({ color: 0x550000 })

  constructor(private scene: THREE.Scene) {
    // Normal enemy hits
    bus.on<{ agentId: string; damage: number; position?: THREE.Vector3 }>(
      'damageEvent',
      (e) => {
        if (!e.position) return
        const count = e.damage > 60 ? 14 : e.damage > 25 ? 10 : 7
        this.splat(e.position, count)
      },
    )

    // Boss hits — bigger splatter
    bus.on<{ id: string; health: number; maxHealth: number }>(
      'bossDamaged',
      () => { /* position not in event — boss handles its own via damageEvent */ },
    )

    // Player death blood pool
    bus.on('playerDied', () => {
      const pp = new THREE.Vector3(0, 0.1, 0)   // approx; will be overridden by update
      this.splat(pp, 30)
    })
  }

  splat(pos: THREE.Vector3, count: number): void {
    if (this.drops.length >= MAX_ACTIVE) return

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.random() * Math.PI
      const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)

      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.8 + 2,  // bias upward
        Math.cos(phi) * speed,
      )

      const mat  = Math.random() > 0.4 ? this.mat : this.darkMat
      const mesh = new THREE.Mesh(this.geo, mat)
      mesh.position.copy(pos)
      mesh.position.y += 0.6   // offset to chest height
      this.scene.add(mesh)

      this.drops.push({ mesh, vel, life: LIFETIME, total: LIFETIME })
    }
  }

  update(dt: number): void {
    for (const d of this.drops) {
      d.life -= dt
      d.vel.y += GRAVITY * dt        // gravity
      d.vel.x *= 1 - 4 * dt          // drag
      d.vel.z *= 1 - 4 * dt
      d.mesh.position.addScaledVector(d.vel, dt)
      // Shrink as they fade
      const frac = Math.max(0, d.life / d.total)
      d.mesh.scale.setScalar(frac * 0.8 + 0.2)
    }

    // Remove dead drops
    const dead = this.drops.filter(d => d.life <= 0)
    for (const d of dead) this.scene.remove(d.mesh)
    this.drops = this.drops.filter(d => d.life > 0)
  }
}
