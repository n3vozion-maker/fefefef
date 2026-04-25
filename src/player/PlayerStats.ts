import { bus } from '../core/EventBus'

const REGEN_DELAY = 4     // s after last hit before regen starts
const REGEN_RATE  = 18    // hp/s

export class PlayerStats {
  health    = 100
  maxHealth = 100
  stamina   = 100
  maxStamina = 100
  armour    = 0

  private noHitTimer = 0
  private dead       = false

  update(dt: number): void {
    if (this.dead) return

    // Regen
    this.noHitTimer = Math.max(0, this.noHitTimer - dt)
    if (this.noHitTimer === 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + REGEN_RATE * dt)
    }

    // Death check
    if (this.health <= 0 && !this.dead) {
      this.dead = true
      bus.emit('playerDied', undefined)
    }
  }

  applyDamage(amount: number): void {
    if (this.dead) return
    const absorbed = Math.min(this.armour, amount * 0.5)
    this.health = Math.max(0, this.health - (amount - absorbed))
    this.noHitTimer = REGEN_DELAY
  }

  respawn(): void {
    this.health    = this.maxHealth
    this.noHitTimer = 0
    this.dead      = false
  }

  isDead(): boolean { return this.dead }
}
