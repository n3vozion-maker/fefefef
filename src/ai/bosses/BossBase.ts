import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }            from '../../core/EventBus'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'

export interface BossPhase {
  healthThreshold: number   // 0-1 fraction
  abilities:       string[]
  speedMult:       number
}

export abstract class BossBase {
  readonly id:    string
  health:         number
  maxHealth:      number
  protected phase = 0
  protected phaseChanged = false
  protected bossName = 'Unknown Boss'

  readonly body: CANNON.Body
  mesh: THREE.Group | THREE.Mesh | null = null

  protected fireTimer   = 0
  protected moveTimer   = 0
  protected moveTarget  = new THREE.Vector3()

  /** Depth of feet below mesh origin in local space — used for Y-lift when scaled. Override per boss. */
  protected footDepth = 1.55

  private aggroed = false
  private despawned = false

  /** Reset boss to full health + un-aggroed — call on New Game */
  resetAggro(): void {
    this.aggroed = false
    this.health  = this.maxHealth
    this.phase   = 0
  }

  constructor(
    id:                   string,
    protected phases:     BossPhase[],
    maxHp:                number,
    spawnX:               number,
    spawnZ:               number,
    physics:              PhysicsWorld,
  ) {
    this.id        = id
    this.maxHealth = maxHp
    this.health    = maxHp

    this.body = new CANNON.Body({ mass: 200, linearDamping: 0.96, angularDamping: 1 })
    this.body.addShape(new CANNON.Cylinder(0.7, 0.7, 2.0, 8))
    this.body.fixedRotation = true
    this.body.position.set(spawnX, 2, spawnZ)
    this.body.updateMassProperties()
    ;(this.body as unknown as Record<string, unknown>)['agentId'] = id
    physics.addBody(this.body)

    bus.on<{ agentId: string; damage: number }>('damageEvent', (e) => {
      if (e.agentId === this.id) this.applyDamage(e.damage)
    })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.isDead()) return
    this.fireTimer  = Math.max(0, this.fireTimer  - dt)
    this.moveTimer  = Math.max(0, this.moveTimer  - dt)
    this.checkPhase()
    this.tick(dt, playerPos)
    this.syncMesh()
  }

  applyDamage(amount: number): void {
    if (this.despawned) return
    this.health = Math.max(0, this.health - amount)
    bus.emit('bossDamaged', { id: this.id, health: this.health, maxHealth: this.maxHealth })
    if (this.isDead()) {
      bus.emit('bossDied', this.id)
      this.scheduleDespawn()
    }
  }

  private scheduleDespawn(): void {
    if (this.despawned) return
    this.despawned = true
    // Flash red for 1.5 s then vanish
    if (this.mesh) {
      this.mesh.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return
        const orig = child.material
        if (orig instanceof THREE.MeshStandardMaterial) {
          const flash = orig.clone()
          flash.emissive.setHex(0xff2200)
          flash.emissiveIntensity = 3.0
          child.material = flash
        }
      })
    }
    setTimeout(() => {
      if (this.mesh) this.mesh.visible = false
      this.body.velocity.set(0, 0, 0)
      this.body.angularVelocity.set(0, 0, 0)
      this.body.collisionResponse = false
      this.body.type = 2   // STATIC — freeze in place
    }, 1500)
  }

  isDead(): boolean { return this.health <= 0 }
  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
  }

  protected abstract tick(dt: number, playerPos: THREE.Vector3): void
  protected abstract onPhaseChange(newPhase: number): void

  /** Call once per tick — emits bossEncountered on first aggro */
  protected checkAggro(playerPos: THREE.Vector3, range = 80): void {
    if (this.aggroed) return
    if (this.getPosition().distanceTo(playerPos) < range) {
      this.aggroed = true
      bus.emit('bossEncountered', { id: this.id, name: this.bossName, maxHealth: this.maxHealth })
      bus.emit('bossMusic', { intensity: 'phase1' })
    }
  }

  protected currentPhase(): BossPhase { return this.phases[this.phase]! }

  protected moveToward(target: THREE.Vector3, speed: number): void {
    const pos = this.getPosition()
    const dir = target.clone().sub(pos)
    dir.y = 0
    if (dir.lengthSq() < 1) return
    dir.normalize().multiplyScalar(speed)
    this.body.velocity.x = dir.x
    this.body.velocity.z = dir.z
  }

  protected shoot(playerPos: THREE.Vector3, damage: number, spread = 0.05): void {
    const origin = this.getPosition().add(new THREE.Vector3(0, 0.8, 0))
    const dir    = playerPos.clone().sub(origin).normalize()
    dir.x += (Math.random() - 0.5) * spread
    dir.y += (Math.random() - 0.5) * spread * 0.5
    dir.normalize()
    bus.emit('aiWeaponFired', { agentId: this.id, origin, direction: dir, damage })
  }

  private checkPhase(): void {
    const ratio = this.health / this.maxHealth
    for (let i = this.phases.length - 1; i > this.phase; i--) {
      const p = this.phases[i]!
      if (ratio <= p.healthThreshold) {
        this.phase = i
        this.onPhaseChange(i)
        bus.emit('bossPhaseChange', { id: this.id, phase: i })
        break
      }
    }
  }

  private syncMesh(): void {
    if (!this.mesh) return
    // Lift mesh so feet stay at ground level when the mesh is scaled up.
    // Formula: lift = (scale - 1) * footDepth  keeps world-feet at body_y - footDepth
    const scale = this.mesh.scale.x
    const lift  = (scale - 1.0) * this.footDepth
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y + lift,
      this.body.position.z,
    )
  }
}
