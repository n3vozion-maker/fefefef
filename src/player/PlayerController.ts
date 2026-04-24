import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { InputManager } from '../input/InputManager'
import type { PlayerCamera } from './PlayerCamera'
import { bus } from '../core/EventBus'
import { Settings } from '../core/Settings'

// ── Tuning ────────────────────────────────────────────────────────────────────
const WALK_SPEED   = 10   // m/s
const SPRINT_SPEED = 16
const CROUCH_SPEED = 5
const JUMP_VEL     = 9    // m/s upward
const AIR_CONTROL  = 0.12 // fraction of desired vel applied per frame in air

const STAMINA_MAX   = 100
const STAMINA_DRAIN = 25  // /s while sprinting
const STAMINA_REGEN = 15  // /s while not sprinting

const VAULT_RANGE      = 1.6   // m — how far ahead to look for a ledge
const VAULT_MAX_HEIGHT = 1.3   // m — tallest obstacle we can vault
const VAULT_MIN_HEIGHT = 0.45  // m — shortest obstacle worth vaulting
const VAULT_DURATION   = 0.32  // s

// ── Body geometry ─────────────────────────────────────────────────────────────
// Total height 1.8 m = barrel (1.1 m) + two end-caps (2 × 0.35 m)
const BARREL_H   = 1.1
const CAP_R      = 0.35
const TOTAL_H    = BARREL_H + CAP_R * 2      // 1.8 m
const HALF_TOTAL = TOTAL_H / 2               // 0.9 m (body centre above ground)
const STAND_CAM  = BARREL_H / 2 + CAP_R - 0.1   // 0.8 m above body centre → eye at 1.7 m
const CROUCH_CAM = -0.2                          // m above body centre when crouching

export class PlayerController {
  readonly body: CANNON.Body
  stamina = STAMINA_MAX

  private grounded  = false
  private crouching = false
  private ads       = false
  private vaulting  = false
  private vaultT    = 0
  private vaultFrom = new THREE.Vector3()
  private vaultTo   = new THREE.Vector3()

  private _moving    = false
  private _sprinting = false

  constructor(
    private physics: PhysicsWorld,
    private input:   InputManager,
    private cam:     PlayerCamera,
  ) {
    this.body = new CANNON.Body({ mass: 80, linearDamping: 0, angularDamping: 1 })
    this.body.addShape(new CANNON.Cylinder(CAP_R, CAP_R, BARREL_H, 8))
    this.body.fixedRotation = true
    this.body.position.set(0, HALF_TOTAL + 0.5, 0)
    this.body.updateMassProperties()
    physics.addBody(this.body)

    bus.on<string>('actionDown', (action) => {
      if (action === 'jump')   this.handleJump()
      if (action === 'crouch') this.crouching = true
      if (action === 'aim')    this.setADS(true)
    })
    bus.on<string>('actionUp', (action) => {
      if (action === 'crouch') this.crouching = false
      if (action === 'aim')    this.setADS(false)
    })
  }

  update(dt: number): void {
    if (this.vaulting) { this.tickVault(dt); return }
    this.checkGround()
    this.tickStamina(dt)
    this.tickMovement(dt)
  }

  getCameraBase(): THREE.Vector3 {
    const camY = this.body.position.y + (this.crouching ? CROUCH_CAM : STAND_CAM)
    return new THREE.Vector3(this.body.position.x, camY, this.body.position.z)
  }

  isMoving():    boolean { return this._moving }
  isSprinting(): boolean { return this._sprinting }

  // ── Private ─────────────────────────────────────────────────────────────────

  private checkGround(): void {
    const { x, y, z } = this.body.position
    const from = new CANNON.Vec3(x, y, z)
    const to   = new CANNON.Vec3(x, y - (HALF_TOTAL + 0.12), z)
    this.grounded = this.physics.raycast(from, to) !== null
  }

  private tickStamina(dt: number): void {
    this._sprinting = (
      this.grounded &&
      !this.crouching &&
      this.stamina > 0 &&
      this.input.isHeld('sprint') &&
      this.input.isHeld('moveForward')
    )
    this.stamina = this._sprinting
      ? Math.max(0,           this.stamina - STAMINA_DRAIN * dt)
      : Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt)
  }

  private tickMovement(dt: number): void {
    const dir = new THREE.Vector3()
    if (this.input.isHeld('moveForward')) dir.z -= 1
    if (this.input.isHeld('moveBack'))    dir.z += 1
    if (this.input.isHeld('moveLeft'))    dir.x -= 1
    if (this.input.isHeld('moveRight'))   dir.x += 1
    this._moving = dir.lengthSq() > 0
    if (this._moving) dir.normalize()
    dir.applyEuler(new THREE.Euler(0, this.cam.getYaw(), 0))

    let speed = this.crouching ? CROUCH_SPEED
              : this._sprinting ? SPRINT_SPEED
              : WALK_SPEED
    if (this.ads) speed *= Settings.adsSpeedMultiplier

    const tvx = dir.x * speed
    const tvz = dir.z * speed

    if (this.grounded) {
      this.body.velocity.x = tvx
      this.body.velocity.z = tvz
    } else {
      // partial air control — keep the snappy feel without full steering
      this.body.velocity.x += (tvx - this.body.velocity.x) * AIR_CONTROL
      this.body.velocity.z += (tvz - this.body.velocity.z) * AIR_CONTROL
    }
    void dt
  }

  private handleJump(): void {
    if (this.vaulting) return
    if (!this.grounded)  return
    if (this.tryVault()) return
    this.body.velocity.y = JUMP_VEL
    bus.emit('playerJumped', undefined)
  }

  private tryVault(): boolean {
    const yaw     = this.cam.getYaw()
    const fwd     = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const { x, y, z } = this.body.position
    const feetY   = y - HALF_TOTAL

    // Ray forward at chest height
    const chestY  = y + STAND_CAM * 0.4
    const wallHit = this.physics.raycast(
      new CANNON.Vec3(x, chestY, z),
      new CANNON.Vec3(x + fwd.x * VAULT_RANGE, chestY, z + fwd.z * VAULT_RANGE),
    )
    if (!wallHit) return false

    // Ray down from above the contact point to find ledge top
    const hx = wallHit.hitPointWorld.x
    const hz = wallHit.hitPointWorld.z
    const topHit = this.physics.raycast(
      new CANNON.Vec3(hx, feetY + VAULT_MAX_HEIGHT + 0.1, hz),
      new CANNON.Vec3(hx, feetY - 0.1, hz),
    )
    if (!topHit) return false

    const ledgeTop = topHit.hitPointWorld.y
    const relHeight = ledgeTop - feetY

    if (relHeight < VAULT_MIN_HEIGHT || relHeight > VAULT_MAX_HEIGHT) return false

    // Land one step beyond the ledge
    const overX = hx + fwd.x * (CAP_R * 2 + 0.3)
    const overZ = hz + fwd.z * (CAP_R * 2 + 0.3)
    const overY = ledgeTop + HALF_TOTAL + 0.05

    this.vaultFrom.set(x, y, z)
    this.vaultTo.set(overX, overY, overZ)
    this.vaultT   = 0
    this.vaulting = true
    bus.emit('playerVaulted', undefined)
    return true
  }

  private tickVault(dt: number): void {
    this.vaultT = Math.min(1, this.vaultT + dt / VAULT_DURATION)
    const t = easeInOut(this.vaultT)

    this.body.position.x = lerp(this.vaultFrom.x, this.vaultTo.x, t)
    this.body.position.y = lerp(this.vaultFrom.y, this.vaultTo.y, t) + Math.sin(t * Math.PI) * 0.35
    this.body.position.z = lerp(this.vaultFrom.z, this.vaultTo.z, t)
    this.body.velocity.set(0, 0, 0)

    if (this.vaultT >= 1) this.vaulting = false
  }

  private setADS(active: boolean): void {
    this.ads = active
    bus.emit<boolean>('adsChanged', active)
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
