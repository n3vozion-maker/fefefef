import * as THREE from 'three'
import type * as CANNON from 'cannon-es'
import { bus }          from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const DASH_SPEED      = 22          // m/s burst
const DASH_DURATION   = 0.18        // seconds
const DASH_CHARGES    = 2
const DASH_RECHARGE   = 1.8         // seconds per charge
const DASH_COOLDOWN   = 0.25        // minimum gap between dashes

const PARRY_WINDOW    = 0.15        // seconds active
const PARRY_COOLDOWN  = 0.8         // seconds
const PARRY_PUNCH_DMG = 40          // melee fallback damage
const PARRY_PUNCH_R   = 3.0         // metres range

// ── TechAbilities ─────────────────────────────────────────────────────────────

export class TechAbilities {
  // Dash state
  private dashCharges   = DASH_CHARGES
  private dashRecharge  = 0          // countdown per charge
  private dashTimer     = 0          // remaining dash duration
  private dashDir       = new THREE.Vector3()
  private dashCooldown  = 0
  isDashing             = false

  // Parry state
  private parryCooldown = 0
  isParrying            = false
  private parryTimer    = 0

  constructor(
    private body: CANNON.Body,
  ) {
    // Parried bullet → re-emit it at double damage toward origin
    bus.on<{ origin: THREE.Vector3; damage: number; direction: THREE.Vector3 }>('weaponFired', (e) => {
      if (!this.isParrying) return
      // Re-fire back at source
      bus.emit('parryDeflect', {
        origin:    e.origin,
        direction: e.direction.clone().negate(),
        damage:    e.damage * 2,
      })
    })
  }

  // ── Dash ──────────────────────────────────────────────────────────────────

  /** Call when player presses dash key. wishDir is normalised move direction in world space. */
  tryDash(wishDir: THREE.Vector3): boolean {
    if (this.dashCooldown > 0 || this.dashCharges <= 0) return false

    this.dashCharges--
    this.dashCooldown = DASH_COOLDOWN
    this.dashTimer    = DASH_DURATION
    this.isDashing    = true

    // If no input, dash forward relative to current velocity or body forward
    if (wishDir.lengthSq() < 0.01) {
      const v = this.body.velocity
      wishDir.set(v.x, 0, v.z).normalize()
      if (wishDir.lengthSq() < 0.01) wishDir.set(0, 0, -1)
    }

    this.dashDir.copy(wishDir).normalize()

    // Apply impulse immediately
    this.body.velocity.set(
      this.dashDir.x * DASH_SPEED,
      this.body.velocity.y,
      this.dashDir.z * DASH_SPEED,
    )

    bus.emit('dashStarted', { charges: this.dashCharges })
    return true
  }

  // ── Parry ─────────────────────────────────────────────────────────────────

  /** Call when player presses parry key. */
  tryParry(
    playerPos: THREE.Vector3,
    forward:   THREE.Vector3,
    getAgents: () => Array<{ position: THREE.Vector3; applyDamage(d: number): void }>,
  ): boolean {
    if (this.parryCooldown > 0) return false

    this.isParrying   = true
    this.parryTimer   = PARRY_WINDOW
    this.parryCooldown = PARRY_COOLDOWN

    // Attempt melee punch if no deflection opportunity
    setTimeout(() => {
      if (this.isParrying) {
        // Still active at end → punch nearby agents
        for (const ag of getAgents()) {
          const d = playerPos.distanceTo(ag.position)
          if (d < PARRY_PUNCH_R) {
            ag.applyDamage(PARRY_PUNCH_DMG)
          }
        }
      }
    }, PARRY_WINDOW * 1000)

    bus.emit('parryStarted', {})
    return true
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    // Dash duration
    if (this.isDashing) {
      this.dashTimer -= dt
      if (this.dashTimer <= 0) {
        this.isDashing = false
        // Halve horizontal speed to not give infinite momentum
        this.body.velocity.set(
          this.body.velocity.x * 0.55,
          this.body.velocity.y,
          this.body.velocity.z * 0.55,
        )
        bus.emit('dashEnded', {})
      } else {
        // Keep maintaining burst speed during dash
        this.body.velocity.set(
          this.dashDir.x * DASH_SPEED,
          this.body.velocity.y,
          this.dashDir.z * DASH_SPEED,
        )
      }
    }

    // Recharge
    if (this.dashCharges < DASH_CHARGES) {
      this.dashRecharge -= dt
      if (this.dashRecharge <= 0) {
        this.dashCharges++
        this.dashRecharge = this.dashCharges < DASH_CHARGES ? DASH_RECHARGE : 0
        bus.emit('dashCharged', { charges: this.dashCharges })
      }
    } else {
      this.dashRecharge = DASH_RECHARGE
    }

    if (this.dashCooldown > 0) this.dashCooldown -= dt

    // Parry window
    if (this.isParrying) {
      this.parryTimer -= dt
      if (this.parryTimer <= 0) this.isParrying = false
    }
    if (this.parryCooldown > 0) this.parryCooldown -= dt
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get charges()       { return this.dashCharges }
  get chargeMax()     { return DASH_CHARGES }
  get rechargeFrac()  { return 1 - Math.max(0, this.dashRecharge) / DASH_RECHARGE }
  get parryCooling()  { return this.parryCooldown > 0 }
}
