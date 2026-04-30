import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }                from '../core/EventBus'
import { calculateDamage }    from './DamageCalculator'
import type { PhysicsWorld }  from '../physics/PhysicsWorld'
import type { WeaponFiredPayload } from '../weapons/WeaponBase'

interface ImpactParticle {
  mesh:   THREE.Mesh
  vel:    THREE.Vector3
  timer:  number
  life:   number
}

const IMPACT_POOL_SIZE = 60
const IMPACT_LIFETIME  = 0.55

export class CombatSystem {
  private impacts:   ImpactParticle[] = []
  private dustGeo   = new THREE.SphereGeometry(0.07, 4, 3)
  private dustMat   = new THREE.MeshBasicMaterial({ color: 0x9a8870, transparent: true, opacity: 0.75, depthWrite: false })

  constructor(
    private physics: PhysicsWorld,
    private scene:   THREE.Scene,
  ) {}

  init(): void {
    bus.on<WeaponFiredPayload>('weaponFired', (p) => this.processShot(p))
  }

  update(dt: number): void {
    for (const p of this.impacts) {
      p.timer -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(1 - 8 * dt)   // drag
      const frac = Math.max(0, p.timer / p.life)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = frac * 0.75
      p.mesh.scale.setScalar(1 + (1 - frac) * 1.8)
      if (p.timer <= 0) this.scene.remove(p.mesh)
    }
    this.impacts = this.impacts.filter(p => p.timer > 0)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private processShot(p: WeaponFiredPayload): void {
    const stats = p.weapon.getStats()
    const maxRange = stats.effectiveRange * 2.5

    const from = new CANNON.Vec3(p.origin.x, p.origin.y, p.origin.z)
    const to   = new CANNON.Vec3(
      p.origin.x + p.direction.x * maxRange,
      p.origin.y + p.direction.y * maxRange,
      p.origin.z + p.direction.z * maxRange,
    )

    const result = this.physics.raycast(from, to)

    // Tracer: fire from origin to actual hit or max range
    const endPt = result
      ? new THREE.Vector3(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z)
      : new THREE.Vector3(
          p.origin.x + p.direction.x * maxRange,
          p.origin.y + p.direction.y * maxRange,
          p.origin.z + p.direction.z * maxRange,
        )
    bus.emit('bulletTracer', { from: p.origin, to: endPt, category: p.weapon.getCategory() })

    if (!result) return

    const hitPt = endPt

    // Check what was hit
    const body = result.body as unknown as { agentId?: string; barrelId?: string; armour?: number }
    if (body?.agentId) {
      const armour = body.armour ?? 0
      const dmg = calculateDamage(
        p.damage ?? stats.damage,
        result.distance,
        stats.effectiveRange,
        armour,
      )
      bus.emit('damageEvent', { agentId: body.agentId, damage: dmg, position: hitPt })
    } else if (body?.barrelId) {
      bus.emit('barrelHit', { barrelId: body.barrelId, position: hitPt })
    } else {
      // Terrain / structure hit — dust puff + audio
      this.spawnImpact(hitPt, result.hitNormalWorld as unknown as THREE.Vector3)
      bus.emit('bulletImpact', { position: hitPt })
    }
  }

  private spawnImpact(pos: THREE.Vector3, _normal?: THREE.Vector3): void {
    const PARTICLES = 4
    for (let i = 0; i < PARTICLES; i++) {
      if (this.impacts.length >= IMPACT_POOL_SIZE) {
        const oldest = this.impacts.shift()!
        this.scene.remove(oldest.mesh)
      }
      // Clone material so opacity is independent per particle
      const mat  = this.dustMat.clone()
      const mesh = new THREE.Mesh(this.dustGeo, mat)
      mesh.position.copy(pos)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 3.5,
      )
      this.scene.add(mesh)
      this.impacts.push({ mesh, vel, timer: IMPACT_LIFETIME, life: IMPACT_LIFETIME })
    }
  }
}
