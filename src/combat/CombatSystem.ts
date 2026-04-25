import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }                from '../core/EventBus'
import { calculateDamage }    from './DamageCalculator'
import type { PhysicsWorld }  from '../physics/PhysicsWorld'
import type { WeaponFiredPayload } from '../weapons/WeaponBase'

interface ImpactDecal {
  mesh:  THREE.Mesh
  timer: number
}

const IMPACT_POOL_SIZE = 40
const IMPACT_LIFETIME  = 6

export class CombatSystem {
  private impacts:  ImpactDecal[] = []
  private impactGeo = new THREE.SphereGeometry(0.06, 4, 4)
  private impactMat = new THREE.MeshBasicMaterial({ color: 0x111111 })

  constructor(
    private physics: PhysicsWorld,
    private scene:   THREE.Scene,
  ) {}

  init(): void {
    bus.on<WeaponFiredPayload>('weaponFired', (p) => this.processShot(p))
  }

  update(dt: number): void {
    for (const imp of this.impacts) {
      imp.timer -= dt
      if (imp.timer <= 0) {
        this.scene.remove(imp.mesh)
      }
    }
    this.impacts = this.impacts.filter(i => i.timer > 0)
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
    if (!result) return

    const hitPt = new THREE.Vector3(
      result.hitPointWorld.x,
      result.hitPointWorld.y,
      result.hitPointWorld.z,
    )

    // Check if an AI agent was hit
    const body = result.body as unknown as { agentId?: string; armour?: number }
    if (body?.agentId) {
      const armour = body.armour ?? 0
      const dmg = calculateDamage(
        p.damage ?? stats.damage,
        result.distance,
        stats.effectiveRange,
        armour,
      )
      bus.emit('damageEvent', { agentId: body.agentId, damage: dmg, position: hitPt })
    } else {
      // Terrain / prop hit — spawn impact mark
      this.spawnImpact(hitPt)
    }
  }

  private spawnImpact(pos: THREE.Vector3): void {
    if (this.impacts.length >= IMPACT_POOL_SIZE) {
      const oldest = this.impacts.shift()!
      this.scene.remove(oldest.mesh)
    }
    const mesh = new THREE.Mesh(this.impactGeo, this.impactMat)
    mesh.position.copy(pos)
    this.scene.add(mesh)
    this.impacts.push({ mesh, timer: IMPACT_LIFETIME })
  }
}
