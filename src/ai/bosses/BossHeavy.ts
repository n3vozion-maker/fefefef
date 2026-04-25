import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// BossHeavy — 2 phases, armoured juggernaut. Sheds armour at 50% HP.
export class BossHeavy extends BossBase {
  private chargeTimer  = 0
  private isCharging   = false
  private chargeTarget = new THREE.Vector3()
  armour               = 30   // absorbed per hit

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_heavy', [
      { healthThreshold: 0.50, abilities: ['minigun', 'stomp'],                      speedMult: 0.8 },
      { healthThreshold: 0.00, abilities: ['minigun', 'stomp', 'charge', 'explRnds'],speedMult: 1.2 },
    ], 1500, spawnX, spawnZ, physics)

    // Update body armour tag
    ;(this.body as unknown as Record<string, unknown>)['armour'] = this.armour
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    const dist  = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // Charge ability (phase 2)
    if (this.phase === 1) {
      if (this.isCharging) {
        this.moveToward(this.chargeTarget, 20)
        if (dist < 3) {
          bus.emit('aiWeaponFired', { agentId: this.id, origin: this.getPosition(), direction: playerPos.clone().sub(this.getPosition()).normalize(), damage: 80 })
          this.isCharging = false
        }
      } else {
        this.chargeTimer -= dt
        if (this.chargeTimer <= 0 && dist < 35) {
          this.isCharging   = true
          this.chargeTarget = playerPos.clone()
          this.chargeTimer  = 8
          bus.emit('bossEvent', { id: this.id, event: 'charge', msg: 'BossHeavy is charging!' })
        }
      }
    }

    if (!this.isCharging) {
      if (dist > 10) this.moveToward(playerPos, 3.5 * phase.speedMult)

      // Minigun spray
      if (this.fireTimer <= 0 && dist < 50) {
        const shots = this.phase === 1 ? 4 : 2
        for (let i = 0; i < shots; i++) {
          setTimeout(() => {
            if (!this.isDead()) this.shoot(playerPos, 22, 0.07)
          }, i * 120)
        }
        this.fireTimer = this.phase === 1 ? 0.5 : 0.9
      }
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      this.armour = 0
      ;(this.body as unknown as Record<string, unknown>)['armour'] = 0
      bus.emit('bossEvent', { id: this.id, event: 'armour_shed', msg: 'BossHeavy sheds armour — ENRAGED!' })
    }
  }
}
