import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }            from '../core/EventBus'
import { selector, sequence, condition, action, type BTNode } from './BehaviourTree'
import type { AlertState }    from './SensorSystem'
import type { PhysicsWorld }  from '../physics/PhysicsWorld'

const AGENT_HEIGHT  = 1.8
const AGENT_RADIUS  = 0.3
const AGENT_BARREL  = AGENT_HEIGHT - AGENT_RADIUS * 2

const WALK_SPEED    = 4.5
const PATROL_SPEED  = 2.5
const CHASE_SPEED   = 6.0
const SHOOT_RANGE   = 35      // m — start shooting
const STOP_RANGE    = 12      // m — stop moving, just shoot
const FIRE_RATE     = 0.55    // seconds between shots
const MAX_HEALTH    = 100

let nextId = 1

export class AIAgent {
  readonly id:     string
  readonly body:   CANNON.Body

  alertState: AlertState  = 'unaware'
  health      = MAX_HEALTH
  armour      = 0

  private tree:       BTNode
  private fireTimer   = 0
  private patrolTimer = 0
  private patrolTarget = new THREE.Vector3()
  private lastKnownPlayerPos: THREE.Vector3 | null = null
  private spawnPos:   THREE.Vector3

  // Visual mesh managed by AISystem
  mesh: THREE.Mesh | null = null

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    this.id       = `agent_${nextId++}`
    this.spawnPos = new THREE.Vector3(spawnX, 0, spawnZ)

    // Physics body
    this.body = new CANNON.Body({ mass: 70, linearDamping: 0.99, angularDamping: 1 })
    this.body.addShape(new CANNON.Cylinder(AGENT_RADIUS, AGENT_RADIUS, AGENT_BARREL, 6))
    this.body.fixedRotation = true
    this.body.position.set(spawnX, AGENT_HEIGHT / 2 + 0.5, spawnZ)
    this.body.updateMassProperties();

    // Tag body so CombatSystem can identify hits
    ;(this.body as unknown as Record<string, unknown>)['agentId'] = this.id
    ;(this.body as unknown as Record<string, unknown>)['armour']  = this.armour
    physics.addBody(this.body)

    // Behaviour tree
    this.tree = this.buildTree()

    // Listen for damage
    bus.on<{ agentId: string; damage: number }>('damageEvent', (e) => {
      if (e.agentId === this.id) this.applyDamage(e.damage)
    })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.isDead()) return
    this.lastKnownPlayerPos = playerPos
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    this.tree.tick({ agent: this, playerPos, dt })
    this.syncMesh()
  }

  applyDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount)
    if (this.alertState === 'unaware') this.alertState = 'combat'
    if (this.isDead()) {
      bus.emit('agentDied', this.id)
      this.body.velocity.set(0, -2, 0)
    }
  }

  isDead(): boolean { return this.health <= 0 }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
  }

  tryShoot(playerPos: THREE.Vector3): void {
    if (this.fireTimer > 0) return
    this.fireTimer = FIRE_RATE + Math.random() * 0.3

    const origin = this.getPosition().add(new THREE.Vector3(0, 0.6, 0))
    const dir    = playerPos.clone().sub(origin).normalize()
    // Add inaccuracy
    dir.x += (Math.random() - 0.5) * 0.08
    dir.y += (Math.random() - 0.5) * 0.04
    dir.normalize()

    bus.emit('aiWeaponFired', { agentId: this.id, origin, direction: dir, damage: 12 })
  }

  // ── Behaviour tree ─────────────────────────────────────────────────────────

  private buildTree(): BTNode {
    type Ctx = { agent: AIAgent; playerPos: THREE.Vector3; dt: number }

    const isDead    = condition((c) => (c as Ctx).agent.isDead())
    const isCombat  = condition((c) => (c as Ctx).agent.alertState === 'combat')
    const canSee    = condition((c) => {
      const ctx = c as Ctx
      const d   = ctx.agent.distanceTo(ctx.playerPos)
      return d < SHOOT_RANGE
    })

    const doShoot = action((c) => {
      const ctx = c as Ctx
      const d   = ctx.agent.distanceTo(ctx.playerPos)
      if (d > SHOOT_RANGE) return 'failure'
      ctx.agent.alertState = 'combat'
      if (d > STOP_RANGE)  ctx.agent.moveTo(ctx.playerPos, CHASE_SPEED, ctx.dt)
      ctx.agent.tryShoot(ctx.playerPos)
      return 'running'
    })

    const doChase = action((c) => {
      const ctx = c as Ctx
      if (!ctx.agent.lastKnownPlayerPos) return 'failure'
      ctx.agent.moveTo(ctx.agent.lastKnownPlayerPos, WALK_SPEED, ctx.dt)
      return 'running'
    })

    const doPatrol = action((c) => {
      const ctx = c as Ctx
      ctx.agent.patrol(ctx.dt)
      return 'running'
    })

    const combatSubtree = selector([doShoot, doChase])

    return selector([
      isDead,
      sequence([isCombat, combatSubtree]),
      sequence([canSee,   combatSubtree]),
      doPatrol,
    ])
  }

  private distanceTo(pos: THREE.Vector3): number {
    return this.getPosition().distanceTo(pos)
  }

  private moveTo(target: THREE.Vector3, speed: number, _dt: number): void {
    const pos = this.getPosition()
    const dir = target.clone().sub(pos)
    dir.y = 0
    if (dir.lengthSq() < 0.25) return
    dir.normalize().multiplyScalar(speed)
    this.body.velocity.x = dir.x
    this.body.velocity.z = dir.z
  }

  private patrol(dt: number): void {
    this.patrolTimer -= dt
    const pos = this.getPosition()
    if (this.patrolTimer <= 0 || pos.distanceTo(this.patrolTarget) < 1.5) {
      this.patrolTimer  = 3 + Math.random() * 4
      const angle       = Math.random() * Math.PI * 2
      const dist        = 5 + Math.random() * 15
      this.patrolTarget.set(
        this.spawnPos.x + Math.cos(angle) * dist,
        pos.y,
        this.spawnPos.z + Math.sin(angle) * dist,
      )
    }
    this.moveTo(this.patrolTarget, PATROL_SPEED, dt)
  }

  private syncMesh(): void {
    if (!this.mesh) return
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)
    if (this.isDead()) this.mesh.rotation.z = Math.PI / 2
  }
}
