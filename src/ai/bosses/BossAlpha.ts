import { BossBase } from './BossBase'

export class BossAlpha extends BossBase {
  constructor() {
    super([
      { healthThreshold: 0.66, abilities: ['burst_fire', 'grenade'] },
      { healthThreshold: 0.33, abilities: ['burst_fire', 'grenade', 'shield'] },
      { healthThreshold: 0.0,  abilities: ['burst_fire', 'grenade', 'shield', 'rage'] },
    ])
    this.maxHealth = 800
    this.health = 800
  }

  protected onPhaseChange(phase: number): void {
    console.log(`BossAlpha entering phase ${phase + 1}`)
  }
}
