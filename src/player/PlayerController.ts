import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import type { InputManager }  from '../input/InputManager'
import type { PlayerCamera }  from './PlayerCamera'
import { bus }                from '../core/EventBus'
import { Settings }           from '../core/Settings'
import { TechAbilities }      from './TechAbilities'

// ── Tuning ────────────────────────────────────────────────────────────────────

const WALK_SPEED   = 10
const SPRINT_SPEED = 16
const CROUCH_SPEED = 5
const JUMP_VEL     = 9
const AIR_CONTROL  = 0.12

const STAMINA_MAX   = 100
const STAMINA_DRAIN = 25
const STAMINA_REGEN = 15

const VAULT_RANGE      = 1.6
const VAULT_MAX_HEIGHT = 1.3
const VAULT_MIN_HEIGHT = 0.45
const VAULT_DURATION   = 0.32

// Wall run
const WALL_RUN_SPEED      = 14          // m/s along wall
const WALL_RUN_DURATION   = 2.5        // s before falling
const WALL_RUN_DECAY_AT   = 1.3        // s — when gravity starts increasing
const WALL_RUN_RAY        = 0.65       // m — side raycast length
const WALL_RUN_MIN_SPD    = 4          // horizontal speed needed to latch
const WALL_JUMP_Y         = 8.5        // upward velocity on wall jump
const WALL_JUMP_AWAY      = 7          // away-from-wall velocity on wall jump
const WALL_JUMP_FWD       = 4          // forward velocity on wall jump

// Slide
const SLIDE_BURST         = 1.38       // entry speed multiplier
const SLIDE_FRICTION      = 7.5        // m/s² deceleration
const SLIDE_MIN_SPD       = 2.5        // exit threshold
const SLIDE_JUMP_Y        = 7.5        // jump-out upward velocity
const SLIDE_STEER         = 0.18       // fraction of full steering while sliding

// Body geometry — 1.8 m tall capsule approximation
const BARREL_H   = 1.1
const CAP_R      = 0.35
const TOTAL_H    = BARREL_H + CAP_R * 2
const HALF_TOTAL = TOTAL_H / 2

const STAND_CAM  =  BARREL_H / 2 + CAP_R - 0.1   //  0.80 m above body centre → eye at ~1.7 m
const CROUCH_CAM = -0.20                           // -0.20 m above body centre
const SLIDE_CAM  = -0.35                           // extra-low during slide
const PRONE_CAM  = -0.52                           // ground-level eye height
const PRONE_SPEED = 2.2

// ── Types ─────────────────────────────────────────────────────────────────────

type MoveState = 'ground' | 'air' | 'wall' | 'vault' | 'slide' | 'prone'

export class PlayerController {
  readonly body: CANNON.Body
  maxStamina = STAMINA_MAX
  stamina    = STAMINA_MAX
  readonly tech: TechAbilities

  private state: MoveState = 'air'

  // wall run
  private wallNormal    = new THREE.Vector3()
  private wallSide: 'left' | 'right' = 'right'
  private wallTimer     = 0
  private lastWallNorm  = new THREE.Vector3()   // prevent re-latching same wall
  private wallJustLeft  = 0                     // cooldown after leaving wall

  // vault
  private vaultT    = 0
  private vaultFrom = new THREE.Vector3()
  private vaultTo   = new THREE.Vector3()

  // slide
  private slideSpeed = 0
  private slideDir   = new THREE.Vector3()

  // locomotion helpers
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

    this.tech = new TechAbilities(this.body)

    bus.on<string>('actionDown', (action) => {
      if (action === 'jump')   this.handleJump()
      if (action === 'crouch') this.handleCrouchDown()
      if (action === 'prone')  this.handleProne()
      if (action === 'aim')    this.setADS(true)
      if (action === 'dash')   this.handleDash()
      if (action === 'parry')  this.handleParry()
    })
    bus.on<string>('actionUp', (action) => {
      if (action === 'crouch') this.handleCrouchUp()
      if (action === 'aim')    this.setADS(false)
    })
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.wallJustLeft > 0) this.wallJustLeft -= dt
    this.tech.update(dt)

    switch (this.state) {
      case 'ground': this.tickGround(dt);  break
      case 'air':    this.tickAir(dt);     break
      case 'wall':   this.tickWall(dt);    break
      case 'vault':  this.tickVault(dt);   break
      case 'slide':  this.tickSlide(dt);   break
      case 'prone':  this.tickProne(dt);   break
    }
  }

  getCameraBase(): THREE.Vector3 {
    let offsetY: number
    switch (this.state) {
      case 'slide': offsetY = SLIDE_CAM;  break
      case 'wall':  offsetY = STAND_CAM;  break
      case 'prone': offsetY = PRONE_CAM;  break
      default:
        offsetY = this.input.isHeld('crouch') && this.state === 'ground'
          ? CROUCH_CAM : STAND_CAM
    }
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y + offsetY,
      this.body.position.z,
    )
  }

  getWallSide():  'left' | 'right' | null { return this.state === 'wall' ? this.wallSide : null }
  isMoving():    boolean { return this._moving }
  isSprinting(): boolean { return this._sprinting }
  isProne():     boolean { return this.state === 'prone'  }
  isCrouching(): boolean { return this.state === 'ground' && this.input.isHeld('crouch') }
  getState():    MoveState { return this.state }

  // ── Ground state ─────────────────────────────────────────────────────────────

  private tickGround(dt: number): void {
    if (!this.checkGround()) { this.enterAir(); return }

    this.tickStamina(dt)

    const crouching = this.input.isHeld('crouch')
    const dir = this.inputDir()
    this._moving = dir.lengthSq() > 0

    let speed = crouching ? CROUCH_SPEED : this._sprinting ? SPRINT_SPEED : WALK_SPEED
    if (this.isADS) speed *= Settings.adsSpeedMultiplier

    this.body.velocity.x = dir.x * speed
    this.body.velocity.z = dir.z * speed
  }

  // ── Air state ─────────────────────────────────────────────────────────────────

  private tickAir(dt: number): void {
    if (this.checkGround()) { this.enterGround(); return }

    // Attempt wall run latch
    if (this.wallJustLeft <= 0) {
      const wall = this.detectWall()
      if (wall) {
        const horizSpd = Math.sqrt(
          this.body.velocity.x ** 2 + this.body.velocity.z ** 2,
        )
        if (horizSpd >= WALL_RUN_MIN_SPD) {
          this.enterWall(wall.normal, wall.side)
          return
        }
      }
    }

    // Air control
    const dir = this.inputDir()
    this._moving = dir.lengthSq() > 0
    this.body.velocity.x += (dir.x * SPRINT_SPEED - this.body.velocity.x) * AIR_CONTROL
    this.body.velocity.z += (dir.z * SPRINT_SPEED - this.body.velocity.z) * AIR_CONTROL
    void dt
  }

  // ── Wall run state ────────────────────────────────────────────────────────────

  private tickWall(dt: number): void {
    if (this.checkGround()) { this.enterGround(); return }

    this.wallTimer += dt

    // Check wall still exists and hasn't changed too much
    const wall = this.detectWall()
    if (!wall || wall.normal.dot(this.wallNormal) < 0.7) {
      this.enterAir(); return
    }

    // Velocity along wall
    const up     = new THREE.Vector3(0, 1, 0)
    const along  = new THREE.Vector3().crossVectors(this.wallNormal, up).normalize()
    const fwd    = this.playerForward()
    if (along.dot(fwd) < 0) along.negate()   // ensure same general direction as player facing

    this.body.velocity.x = along.x * WALL_RUN_SPEED
    this.body.velocity.z = along.z * WALL_RUN_SPEED

    // Gravity decay — starts gentle, increases after WALL_RUN_DECAY_AT
    const excess = Math.max(0, this.wallTimer - WALL_RUN_DECAY_AT)
    const gravityPull = -2 - excess * 5
    this.body.velocity.y = Math.max(gravityPull, this.body.velocity.y - 3 * dt)

    if (this.wallTimer >= WALL_RUN_DURATION) { this.enterAir(); return }

    this.cam.setWallTilt(this.wallSide)
    this._moving = true
  }

  // ── Vault state ───────────────────────────────────────────────────────────────

  private tickVault(dt: number): void {
    this.vaultT = Math.min(1, this.vaultT + dt / VAULT_DURATION)
    const t = easeInOut(this.vaultT)

    this.body.position.x = lerp(this.vaultFrom.x, this.vaultTo.x, t)
    this.body.position.y = lerp(this.vaultFrom.y, this.vaultTo.y, t) + Math.sin(t * Math.PI) * 0.35
    this.body.position.z = lerp(this.vaultFrom.z, this.vaultTo.z, t)
    this.body.velocity.set(0, 0, 0)

    if (this.vaultT >= 1) this.enterGround()
  }

  // ── Slide state ───────────────────────────────────────────────────────────────

  private tickSlide(dt: number): void {
    if (!this.checkGround()) { this.enterAir(); return }

    this.slideSpeed = Math.max(0, this.slideSpeed - SLIDE_FRICTION * dt)

    // Allow slight steering during slide
    const steer = this.inputDir().multiplyScalar(SLIDE_STEER)
    const dir   = this.slideDir.clone().add(steer).normalize()

    this.body.velocity.x = dir.x * this.slideSpeed
    this.body.velocity.z = dir.z * this.slideSpeed

    this._moving = true
    this._sprinting = false

    if (this.slideSpeed < SLIDE_MIN_SPD) this.enterGround()
  }

  // ── State transitions ─────────────────────────────────────────────────────────

  private enterGround(): void {
    this.state = 'ground'
    this.cam.setWallTilt(null)
    this.lastWallNorm.set(0, 0, 0)
  }

  private enterAir(): void {
    this.state = 'air'
    this.cam.setWallTilt(null)
  }

  private enterWall(normal: THREE.Vector3, side: 'left' | 'right'): void {
    this.state      = 'wall'
    this.wallNormal.copy(normal)
    this.wallSide   = side
    this.wallTimer  = 0
    this.lastWallNorm.copy(normal)
    bus.emit('wallRunStart', side)
  }

  private enterSlide(): void {
    const spd = Math.sqrt(this.body.velocity.x ** 2 + this.body.velocity.z ** 2)
    if (spd < WALK_SPEED) return   // need minimum speed to slide

    this.state = 'slide'
    this.slideSpeed = spd * SLIDE_BURST
    this.slideDir.set(this.body.velocity.x, 0, this.body.velocity.z).normalize()
    bus.emit('slideStart', undefined)
  }

  // ── Jump / action handlers ────────────────────────────────────────────────────

  private handleJump(): void {
    switch (this.state) {
      case 'ground':
        if (!this.tryVault()) {
          this.body.velocity.y = JUMP_VEL
          this.enterAir()
          bus.emit('playerJumped', undefined)
        }
        break

      case 'wall': {
        // Wall jump — launch away from wall + upward + forward
        const fwd = this.playerForward()
        this.body.velocity.x = this.wallNormal.x * WALL_JUMP_AWAY + fwd.x * WALL_JUMP_FWD
        this.body.velocity.y = WALL_JUMP_Y
        this.body.velocity.z = this.wallNormal.z * WALL_JUMP_AWAY + fwd.z * WALL_JUMP_FWD
        this.wallJustLeft = 0.35   // prevent immediately re-latching same wall
        this.enterAir()
        bus.emit('wallJump', undefined)
        break
      }

      case 'slide':
        // Slide jump — keep horizontal momentum, add upward boost
        this.body.velocity.x = this.slideDir.x * this.slideSpeed
        this.body.velocity.z = this.slideDir.z * this.slideSpeed
        this.body.velocity.y = SLIDE_JUMP_Y
        this.enterAir()
        bus.emit('slideJump', undefined)
        break

      case 'air':
        // Try wall latch to chain (jump while near wall in air resets latch)
        if (this.wallJustLeft <= 0) {
          const wall = this.detectWall()
          if (wall) { this.enterWall(wall.normal, wall.side); return }
        }
        break
    }
  }

  private handleCrouchDown(): void {
    if (this.state === 'ground' && this._sprinting) this.enterSlide()
  }

  private handleCrouchUp(): void {
    // crouching is read directly from input.isHeld in tickGround
  }

  private handleProne(): void {
    if (this.state === 'ground' || this.state === 'slide') {
      this.state = 'prone'
      bus.emit('proneChanged', true)
    } else if (this.state === 'prone') {
      this.state = 'ground'
      bus.emit('proneChanged', false)
    }
  }

  private tickProne(dt: number): void {
    if (!this.checkGround()) { this.state = 'air'; bus.emit('proneChanged', false); return }
    this._sprinting = false
    this.tickStamina(dt)
    const dir = this.inputDir()
    this._moving = dir.lengthSq() > 0
    this.body.velocity.x = dir.x * PRONE_SPEED
    this.body.velocity.z = dir.z * PRONE_SPEED
  }

  private handleDash(): void {
    if (this.tech.isDashing) return
    const wishDir = this.inputDir()
    this.tech.tryDash(wishDir)
  }

  private handleParry(): void {
    const pos = new THREE.Vector3(
      this.body.position.x, this.body.position.y, this.body.position.z,
    )
    const fwd = this.playerForward()
    this.tech.tryParry(pos, fwd, () => [])
  }

  // ── Vault ─────────────────────────────────────────────────────────────────────

  private tryVault(): boolean {
    const yaw = this.cam.getYaw()
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    const { x, y, z } = this.body.position
    const feetY = y - HALF_TOTAL

    const wallHit = this.physics.raycast(
      new CANNON.Vec3(x, y + STAND_CAM * 0.4, z),
      new CANNON.Vec3(x + fwd.x * VAULT_RANGE, y + STAND_CAM * 0.4, z + fwd.z * VAULT_RANGE),
    )
    if (!wallHit) return false

    const hx = wallHit.hitPointWorld.x
    const hz = wallHit.hitPointWorld.z
    const topHit = this.physics.raycast(
      new CANNON.Vec3(hx, feetY + VAULT_MAX_HEIGHT + 0.1, hz),
      new CANNON.Vec3(hx, feetY - 0.1, hz),
    )
    if (!topHit) return false

    const rel = topHit.hitPointWorld.y - feetY
    if (rel < VAULT_MIN_HEIGHT || rel > VAULT_MAX_HEIGHT) return false

    this.vaultFrom.set(x, y, z)
    this.vaultTo.set(
      hx + fwd.x * (CAP_R * 2 + 0.3),
      topHit.hitPointWorld.y + HALF_TOTAL + 0.05,
      hz + fwd.z * (CAP_R * 2 + 0.3),
    )
    this.vaultT = 0
    this.state  = 'vault'
    bus.emit('playerVaulted', undefined)
    return true
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private checkGround(): boolean {
    const { x, y, z } = this.body.position
    const hit = this.physics.raycast(
      new CANNON.Vec3(x, y, z),
      new CANNON.Vec3(x, y - (HALF_TOTAL + 0.12), z),
    )
    return hit !== null
  }

  private detectWall(): { normal: THREE.Vector3; side: 'left' | 'right' } | null {
    const yaw   = this.cam.getYaw()
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    const { x, y, z } = this.body.position

    for (const [vec, side] of [
      [right, 'right'],
      [right.clone().negate(), 'left'],
    ] as const) {
      const hit = this.physics.raycast(
        new CANNON.Vec3(x, y, z),
        new CANNON.Vec3(x + vec.x * WALL_RUN_RAY, y, z + vec.z * WALL_RUN_RAY),
      )
      if (!hit) continue

      const normal = new THREE.Vector3(
        hit.hitNormalWorld.x, 0, hit.hitNormalWorld.z,
      ).normalize()

      // Don't re-latch the wall we just jumped off
      if (normal.dot(this.lastWallNorm) > 0.85 && this.wallJustLeft > 0) continue

      // Wall must be mostly to the side (not directly ahead → vault handles that)
      const fwd = this.playerForward()
      if (Math.abs(normal.dot(fwd)) > 0.7) continue

      return { normal, side }
    }
    return null
  }

  private inputDir(): THREE.Vector3 {
    const dir = new THREE.Vector3()
    if (this.input.isHeld('moveForward')) dir.z -= 1
    if (this.input.isHeld('moveBack'))    dir.z += 1
    if (this.input.isHeld('moveLeft'))    dir.x -= 1
    if (this.input.isHeld('moveRight'))   dir.x += 1
    if (dir.lengthSq() > 0) dir.normalize()
    dir.applyEuler(new THREE.Euler(0, this.cam.getYaw(), 0))
    return dir
  }

  private playerForward(): THREE.Vector3 {
    const yaw = this.cam.getYaw()
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
  }

  private tickStamina(dt: number): void {
    this._sprinting = (
      this.state === 'ground' &&
      !this.input.isHeld('crouch') &&
      this.stamina > 0 &&
      this.input.isHeld('sprint') &&
      this.input.isHeld('moveForward')
    )
    this.stamina = this._sprinting
      ? Math.max(0,                this.stamina - STAMINA_DRAIN * dt)
      : Math.min(this.maxStamina,  this.stamina + STAMINA_REGEN * dt)
  }

  private isADS = false
  private setADS(active: boolean): void {
    this.isADS = active
    bus.emit<boolean>('adsChanged', active)
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
