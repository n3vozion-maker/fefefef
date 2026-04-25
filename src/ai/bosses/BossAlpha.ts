import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// BossAlpha — 3 phases, elite soldier with shield + grenade abilities
export class BossAlpha extends BossBase {
  private grenadeTimer = 0
  private shieldActive = false

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_alpha', [
      { healthThreshold: 0.66, abilities: ['burst_fire', 'grenade'],          speedMult: 1.0 },
      { healthThreshold: 0.33, abilities: ['burst_fire', 'grenade', 'shield'],speedMult: 1.3 },
      { healthThreshold: 0.00, abilities: ['burst_fire', 'grenade', 'rage'],  speedMult: 1.7 },
    ], 800, spawnX, spawnZ, physics)
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    const dist = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // Move toward player unless too close
    if (dist > 8) this.moveToward(playerPos, 5 * phase.speedMult)

    // Burst fire
    if (this.fireTimer <= 0 && dist < 40) {
      this.burstFire(playerPos)
      this.fireTimer = this.phase === 2 ? 0.8 : 1.4
    }

    // Grenade lob
    this.grenadeTimer -= dt
    if (this.grenadeTimer <= 0 && dist < 30 && this.phase >= 1) {
      this.lobGrenade(playerPos)
      this.grenadeTimer = 6
    }

    // Shield (phase 2)
    this.shieldActive = this.phase === 1 && (Math.floor(Date.now() / 3000) % 2 === 0)
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) bus.emit('bossEvent', { id: this.id, event: 'shield_up', msg: 'BossAlpha activates energy shield!' })
    if (newPhase === 2) bus.emit('bossEvent', { id: this.id, event: 'rage',     msg: 'BossAlpha enters RAGE mode!' })
  }

  private burstFire(playerPos: THREE.Vector3): void {
    const bursts = this.phase === 2 ? 5 : 3
    for (let i = 0; i < bursts; i++) {
      setTimeout(() => {
        if (!this.isDead()) this.shoot(playerPos, 18 + this.phase * 5, 0.04)
      }, i * 80)
    }
  }

  private lobGrenade(playerPos: THREE.Vector3): void {
    bus.emit('grenadeThrown', {
      origin:   this.getPosition().clone().add(new THREE.Vector3(0, 1, 0)),
      target:   playerPos.clone(),
      damage:   60,
      radius:   6,
      agentId:  this.id,
    })
  }
}
