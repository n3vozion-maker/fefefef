import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }     from '../../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const HP           = 120
const ENGAGE_MIN   = 55      // metres — prefers long range
const ENGAGE_MAX   = 110
const WINDUP       = 1.4     // seconds laser-sight before shot
const FIRE_CD      = 4.2     // reload time after shot
const DAMAGE       = 65
const MOVE_SPEED   = 3.5     // repositions slowly
const AGGRO_R      = 130
const LASER_COLOR  = 0xff3300

// ── EnemySniper ───────────────────────────────────────────────────────────────

export class EnemySniper {
  body:   CANNON.Body
  mesh:   THREE.Group
  hp      = HP
  alive   = true

  private state: 'idle' | 'reposition' | 'windup' | 'cooldown' = 'idle'
  private stateTimer = 0
  private laserLine: THREE.Line | null = null
  private targetPos  = new THREE.Vector3()

  constructor(
    wx: number, wz: number,
    private physics: { world: CANNON.World },
    private scene: THREE.Scene,
  ) {
    // Physics capsule
    const shape = new CANNON.Cylinder(0.35, 0.35, 1.8, 8)
    this.body   = new CANNON.Body({ mass: 80, linearDamping: 0.99, angularDamping: 1 })
    this.body.addShape(shape)
    this.body.position.set(wx, 5, wz)
    ;(this.body as unknown as Record<string,unknown>).agentId = `sniper_${wx}_${wz}`
    ;(this.body as unknown as Record<string,unknown>).armour  = 0
    ;(this.body as unknown as Record<string,unknown>).onDamage = (dmg: number) => this.applyDamage(dmg)
    physics.world.addBody(this.body)

    // Mesh: tall slim figure, dark ghillie green
    const geo  = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8)
    const mat  = new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.9 })
    const body = new THREE.Mesh(geo, mat)
    body.castShadow = true

    this.mesh = new THREE.Group()
    this.mesh.add(body)
    scene.add(this.mesh)
  }

  applyDamage(dmg: number): void {
    if (!this.alive) return
    this.hp -= dmg
    if (this.hp <= 0) this.die()
  }

  private die(): void {
    this.alive = false
    this.removeLaser()
    this.scene.remove(this.mesh)
    this.physics.world.removeBody(this.body)
    bus.emit('agentDied', { agentId: (this.body as unknown as Record<string,unknown>).agentId })
  }

  private removeLaser(): void {
    if (this.laserLine) {
      this.scene.remove(this.laserLine)
      this.laserLine.geometry.dispose()
      this.laserLine = null
    }
  }

  private showLaser(from: THREE.Vector3, to: THREE.Vector3): void {
    this.removeLaser()
    const points = [from.clone(), to.clone()]
    const geo    = new THREE.BufferGeometry().setFromPoints(points)
    const mat    = new THREE.LineBasicMaterial({ color: LASER_COLOR, transparent: true, opacity: 0.7 })
    this.laserLine = new THREE.Line(geo, mat)
    this.scene.add(this.laserLine)
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.alive) return

    const pos = new THREE.Vector3(
      this.body.position.x, this.body.position.y, this.body.position.z,
    )
    this.mesh.position.copy(pos)

    const dist = pos.distanceTo(playerPos)

    this.stateTimer -= dt

    switch (this.state) {

      case 'idle': {
        if (dist < AGGRO_R) {
          if (dist < ENGAGE_MIN || dist > ENGAGE_MAX) {
            this.state      = 'reposition'
            this.stateTimer = 3.0
          } else {
            this.state      = 'windup'
            this.stateTimer = WINDUP
          }
        }
        break
      }

      case 'reposition': {
        // Move toward ideal range
        const ideal = ENGAGE_MIN + (ENGAGE_MAX - ENGAGE_MIN) * 0.5
        const tooClose = dist < ideal
        const dir = new THREE.Vector3().subVectors(pos, playerPos).normalize()
        const moveDir = tooClose ? dir : dir.negate()

        this.body.velocity.set(
          moveDir.x * MOVE_SPEED,
          this.body.velocity.y,
          moveDir.z * MOVE_SPEED,
        )

        if (this.stateTimer <= 0 || (dist >= ENGAGE_MIN && dist <= ENGAGE_MAX)) {
          this.body.velocity.set(0, this.body.velocity.y, 0)
          this.state      = 'windup'
          this.stateTimer = WINDUP
        }
        break
      }

      case 'windup': {
        // Show laser sight
        const muzzle = pos.clone().add(new THREE.Vector3(0, 0.7, 0))
        this.showLaser(muzzle, playerPos)

        if (this.stateTimer <= 0) {
          this.removeLaser()
          // Fire — if player hasn't moved out of LOS we hit
          if (dist < AGGRO_R) {
            bus.emit('aiWeaponFired', {
              origin: muzzle,
              damage: DAMAGE,
              isSniper: true,
            })
          }
          this.state      = 'cooldown'
          this.stateTimer = FIRE_CD
        }
        break
      }

      case 'cooldown': {
        if (this.stateTimer <= 0) {
          this.state = dist >= ENGAGE_MIN && dist <= ENGAGE_MAX ? 'windup' : 'reposition'
          this.stateTimer = this.state === 'windup' ? WINDUP : 3.0
        }
        break
      }
    }
  }

  dispose(): void {
    this.removeLaser()
    if (this.alive) {
      this.scene.remove(this.mesh)
      this.physics.world.removeBody(this.body)
    }
  }
}
