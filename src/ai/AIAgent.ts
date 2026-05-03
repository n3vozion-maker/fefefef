import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }            from '../core/EventBus'
import { selector, sequence, condition, action, type BTNode } from './BehaviourTree'
import type { AlertState }    from './SensorSystem'
import type { PhysicsWorld }  from '../physics/PhysicsWorld'
import type { SquadRole }     from './SquadManager'
import { ghillie }            from '../effects/GhillieSystem'

const AGENT_HEIGHT  = 1.8
const AGENT_RADIUS  = 0.3
const AGENT_BARREL  = AGENT_HEIGHT - AGENT_RADIUS * 2

const WALK_SPEED    = 4.5
const PATROL_SPEED  = 2.5

export type EnemyType = 'standard' | 'scout' | 'gunner'

interface EnemyStats {
  maxHealth:   number
  chaseSpeed:  number
  shootRange:  number
  stopRange:   number
  fireRate:    number
  damage:      number
}

const TYPE_STATS: Record<EnemyType, EnemyStats> = {
  standard: { maxHealth: 100, chaseSpeed: 6.0, shootRange: 35, stopRange: 12, fireRate: 0.55, damage: 12 },
  scout:    { maxHealth:  50, chaseSpeed: 9.2, shootRange: 22, stopRange:  4, fireRate: 0.42, damage:  8 },
  gunner:   { maxHealth: 180, chaseSpeed: 3.2, shootRange: 30, stopRange: 15, fireRate: 0.95, damage: 22 },
}

// 4 distinct death poses: forward, backward, left, right
const DEATH_POSES: Array<[number, number, number]> = [
  [ Math.PI / 2,  0, 0],   // crumple forward
  [-Math.PI / 2,  0, 0],   // fall back
  [0,  0,  Math.PI / 2],   // topple right
  [0,  0, -Math.PI / 2],   // topple left
]

let nextId = 1

export class AIAgent {
  readonly id:     string
  readonly body:   CANNON.Body
  readonly type:   EnemyType

  alertState: AlertState  = 'unaware'
  health:     number
  armour      = 0
  squadRole:  SquadRole   = 'suppressor'

  readonly _stats: EnemyStats
  private _flankSide = Math.random() < 0.5 ? 1 : -1

  private tree:       BTNode
  private fireTimer   = 0
  private patrolTimer = 0
  private patrolTarget = new THREE.Vector3()
  private lastKnownPlayerPos: THREE.Vector3 | null = null
  private spawnPos:   THREE.Vector3

  // Hit reaction
  private hitFlashTimer = 0

  // Tactical movement
  private retreatTimer    = 0
  private suppressionTimer = 0   // when > 0: stay in place + fire rapidly
  private strafeDir:  1 | -1 = 1
  private strafeTimer = 0

  // Grenade throw
  private grenadeTimer = 5 + Math.random() * 8

  // Death
  private deathPose = 0

  // Patrol route (set by AISystem)
  private patrolRoute:  THREE.Vector3[] | null = null
  private routeIdx      = 0
  private routeDwell    = 0   // seconds to wait at current waypoint

  // Alert indicator mesh (! above head)
  private alertMesh: THREE.Mesh | null = null
  private alertMeshTimer = 0

  // Lost-player timer — resets to patrol after staying out of range
  private lostTimer = 0
  private static readonly LOST_PATIENCE = 13   // s

  // Visual mesh managed by AISystem (Group for articulated soldier models)
  mesh: THREE.Object3D | null = null

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld, type: EnemyType = 'standard') {
    this.id       = `agent_${nextId++}`
    this.type     = type
    this._stats   = TYPE_STATS[type]
    this.health   = this._stats.maxHealth
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

  /** Assign a looping patrol route. Call once after construction. */
  setPatrolRoute(waypoints: THREE.Vector3[], startIdx = 0): void {
    this.patrolRoute = waypoints
    this.routeIdx    = startIdx % waypoints.length
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.isDead()) return
    this.lastKnownPlayerPos = playerPos
    this.fireTimer    = Math.max(0, this.fireTimer - dt)
    this.strafeTimer  = Math.max(0, this.strafeTimer - dt)
    this.grenadeTimer = Math.max(0, this.grenadeTimer - dt)
    if (this.retreatTimer   > 0) this.retreatTimer   -= dt
    if (this.suppressionTimer > 0) this.suppressionTimer -= dt

    // Lost-player reset: if combat but player has been out of range too long, resume patrol
    if (this.alertState === 'combat') {
      if (this.distanceTo(playerPos) > this._stats.shootRange * 2.5) {
        this.lostTimer += dt
        if (this.lostTimer >= AIAgent.LOST_PATIENCE) {
          this.alertState = 'unaware'
          this.lostTimer  = 0
        }
      } else {
        this.lostTimer = 0
      }
    } else {
      this.lostTimer = 0
    }

    // Alert indicator
    if (this.alertMeshTimer > 0) {
      this.alertMeshTimer -= dt
      if (this.alertMeshTimer <= 0 && this.alertMesh) {
        this.alertMesh.visible = false
      }
    }

    this.tree.tick({ agent: this, playerPos, dt })
    this.syncMesh(dt)
  }

  applyDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount)
    if (this.alertState === 'unaware') {
      this.alertState = 'combat'
      this.lostTimer  = 0
      this.showAlertIndicator()
    }
    if (this.isDead()) {
      this.deathPose = Math.floor(Math.random() * DEATH_POSES.length)
      bus.emit('agentDied', this.id)
      bus.emit('agentDrops', { position: this.getPosition() })
      this.body.velocity.set(0, -2, 0)
    } else {
      // Visible hit flash
      this.hitFlashTimer = 0.14
      const roll = Math.random()
      if (roll < 0.35) {
        // 35%: suppress — hold position and return fire rapidly
        this.suppressionTimer = 1.2 + Math.random() * 0.8
        this.retreatTimer     = 0
      } else if (roll < 0.65) {
        // 30%: briefly retreat
        this.retreatTimer = 0.6 + Math.random() * 0.6
      }
      // 35%: keep advancing (aggressive AI)
    }
  }

  isDead(): boolean { return this.health <= 0 }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
  }

  tryThrowGrenade(playerPos: THREE.Vector3): void {
    if (this.grenadeTimer > 0) return
    const d = this.distanceTo(playerPos)
    if (d < 8 || d > 28) return   // too close or too far
    if (Math.random() > 0.28) {   // 28% chance when timer ready
      this.grenadeTimer = 9 + Math.random() * 7
      return
    }
    const origin = this.getPosition().add(new THREE.Vector3(0, 1.2, 0))
    bus.emit('aiGrenadeThrown', { origin, target: playerPos.clone() })
    this.grenadeTimer = 10 + Math.random() * 8
  }

  tryShoot(playerPos: THREE.Vector3): void {
    if (this.fireTimer > 0) return
    this.fireTimer = this._stats.fireRate + Math.random() * 0.3

    const origin = this.getPosition().add(new THREE.Vector3(0, 0.6, 0))
    const dir    = playerPos.clone().sub(origin).normalize()
    dir.x += (Math.random() - 0.5) * 0.08
    dir.y += (Math.random() - 0.5) * 0.04
    dir.normalize()

    bus.emit('aiWeaponFired', { agentId: this.id, origin, direction: dir, damage: this._stats.damage })
  }

  // ── Alert indicator ───────────────────────────────────────────────────────

  /** Flashes a red "!" above the agent's head for 1.8 s on first alert. */
  showAlertIndicator(): void {
    if (this.alertMeshTimer > 0) return  // already showing
    if (!this.mesh) return

    if (!this.alertMesh) {
      // Build once: a small red box + exclamation glyph approximation
      const geo  = new THREE.BoxGeometry(0.12, 0.30, 0.06)
      const mat  = new THREE.MeshBasicMaterial({ color: 0xff2200, depthTest: false })
      this.alertMesh = new THREE.Mesh(geo, mat)
      this.alertMesh.position.set(0, 2.35, 0)
      this.mesh.add(this.alertMesh)

      // Dot under the bar
      const dot    = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.06), mat.clone())
      dot.position.set(0, -0.24, 0)
      this.alertMesh.add(dot)
    }

    this.alertMesh.visible = true
    this.alertMeshTimer    = 1.8
  }

  // ── Behaviour tree ─────────────────────────────────────────────────────────

  private buildTree(): BTNode {
    type Ctx = { agent: AIAgent; playerPos: THREE.Vector3; dt: number }

    const isDead   = condition((c) => (c as Ctx).agent.isDead())
    const isCombat = condition((c) => (c as Ctx).agent.alertState === 'combat')
    const canSee   = condition((c) => {
      const ctx   = c as Ctx
      const range = ghillie.active
        ? Math.min(10, ctx.agent._stats.shootRange)
        : ctx.agent._stats.shootRange
      return ctx.agent.distanceTo(ctx.playerPos) < range
    })

    const doShoot = action((c) => {
      const ctx = c as Ctx
      const d   = ctx.agent.distanceTo(ctx.playerPos)
      const s   = ctx.agent._stats
      if (d > s.shootRange) return 'failure'
      if (ctx.agent.alertState !== 'combat') {
        ctx.agent.alertState = 'combat'
        ctx.agent.lostTimer  = 0
        ctx.agent.showAlertIndicator()
      }

      if (ctx.agent.suppressionTimer > 0) {
        // Suppressed: hold position, crouch-tilt mesh, fire twice as fast
        ctx.agent.body.velocity.x *= 0.1
        ctx.agent.body.velocity.z *= 0.1
        if (ctx.agent.fireTimer <= 0) ctx.agent.fireTimer = 0   // bypass cooldown once
        ctx.agent.tryShoot(ctx.playerPos)
        ctx.agent.tryThrowGrenade(ctx.playerPos)
        return 'running'
      } else if (ctx.agent.retreatTimer > 0) {
        ctx.agent.moveAway(ctx.playerPos, WALK_SPEED, ctx.dt)
      } else if (ctx.agent.squadRole === 'flanker' && d > s.stopRange) {
        // Flanker: sweep wide to the side before closing in
        const flankTarget = ctx.agent.calcFlankPos(ctx.playerPos)
        const distToFlank = ctx.agent.distanceTo(flankTarget)
        if (distToFlank > 4) {
          ctx.agent.moveTo(flankTarget, s.chaseSpeed * 1.15, ctx.dt)
        } else {
          ctx.agent.moveToWithStrafe(ctx.playerPos, s.chaseSpeed, ctx.dt)
        }
      } else if (d > s.stopRange) {
        ctx.agent.moveToWithStrafe(ctx.playerPos, s.chaseSpeed, ctx.dt)
      } else {
        ctx.agent.strafe(ctx.playerPos, 3.8, ctx.dt)
      }

      ctx.agent.tryShoot(ctx.playerPos)
      ctx.agent.tryThrowGrenade(ctx.playerPos)
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

  // ── Movement helpers ───────────────────────────────────────────────────────

  calcFlankPos(playerPos: THREE.Vector3): THREE.Vector3 {
    const pos      = this.getPosition()
    const toPlayer = playerPos.clone().sub(pos)
    toPlayer.y = 0
    if (toPlayer.lengthSq() < 0.01) return playerPos.clone()
    toPlayer.normalize()
    const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this._flankSide * 20)
    return playerPos.clone().add(perp)
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

  private moveAway(target: THREE.Vector3, speed: number, _dt: number): void {
    const pos = this.getPosition()
    const dir = pos.clone().sub(target)
    dir.y = 0
    if (dir.lengthSq() < 0.01) {
      dir.set(Math.random() - 0.5, 0, Math.random() - 0.5)
    }
    dir.normalize().multiplyScalar(speed)
    this.body.velocity.x = dir.x
    this.body.velocity.z = dir.z
  }

  // Advance toward player while drifting perpendicular (weaving approach)
  private moveToWithStrafe(target: THREE.Vector3, speed: number, dt: number): void {
    const pos      = this.getPosition()
    const toPlayer = target.clone().sub(pos)
    toPlayer.y = 0
    if (toPlayer.lengthSq() < 0.01) return
    toPlayer.normalize()

    const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x)
    const combined = toPlayer.clone().addScaledVector(perp, this.strafeDir * 0.5).normalize()

    this.body.velocity.x = combined.x * speed
    this.body.velocity.z = combined.z * speed

    this.updateStrafeTimer(dt)
  }

  // Pure lateral strafe at close range
  private strafe(target: THREE.Vector3, speed: number, dt: number): void {
    const pos      = this.getPosition()
    const toPlayer = target.clone().sub(pos)
    toPlayer.y = 0
    if (toPlayer.lengthSq() < 0.01) return
    toPlayer.normalize()

    const perp = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x)
    perp.multiplyScalar(this.strafeDir * speed)

    this.body.velocity.x = perp.x
    this.body.velocity.z = perp.z

    this.updateStrafeTimer(dt)
  }

  private updateStrafeTimer(dt: number): void {
    if (this.strafeTimer <= 0) {
      this.strafeDir   = this.strafeDir === 1 ? -1 : 1
      this.strafeTimer = 1.1 + Math.random() * 1.6
    } else {
      this.strafeTimer -= dt
    }
  }

  private patrol(dt: number): void {
    if (this.patrolRoute && this.patrolRoute.length > 0) {
      this.patrolRouteStep(dt)
    } else {
      this.patrolRandom(dt)
    }
  }

  private patrolRouteStep(dt: number): void {
    const route  = this.patrolRoute!
    const target = route[this.routeIdx]!
    const pos    = this.getPosition()
    const dx     = target.x - pos.x
    const dz     = target.z - pos.z
    const dist2d = Math.sqrt(dx * dx + dz * dz)

    if (dist2d < 2.2) {
      // Reached waypoint — dwell briefly then advance
      this.routeDwell -= dt
      if (this.routeDwell <= 0) {
        this.routeIdx  = (this.routeIdx + 1) % route.length
        this.routeDwell = 1.8 + Math.random() * 2.5
      }
    } else {
      // Walk toward waypoint, matching terrain height
      this.moveTo(new THREE.Vector3(target.x, pos.y, target.z), PATROL_SPEED, dt)
    }
  }

  private patrolRandom(dt: number): void {
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

  // ── Mesh sync ──────────────────────────────────────────────────────────────

  private syncMesh(dt: number): void {
    if (!this.mesh) return
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z)

    if (this.isDead()) {
      const pose = DEATH_POSES[this.deathPose] ?? DEATH_POSES[0]!
      this.mesh.rotation.set(pose[0], pose[1], pose[2])
    }

    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt
      const flashMesh = this.mesh.userData['flashMesh'] as THREE.Mesh | undefined
      if (flashMesh) {
        (flashMesh.material as THREE.MeshBasicMaterial).opacity =
          this.hitFlashTimer > 0 ? 0.55 * (this.hitFlashTimer / 0.14) : 0
      }
    } else {
      const flashMesh = this.mesh.userData['flashMesh'] as THREE.Mesh | undefined
      if (flashMesh) (flashMesh.material as THREE.MeshBasicMaterial).opacity = 0
    }
  }
}
