import { BossBase } from './BossBase'

export class BossHeavy extends BossBase {
  private armourShed = false

  constructor() {
    super([
      { healthThreshold: 0.5, abilities: ['minigun', 'stomp'] },
      { healthThreshold: 0.0, abilities: ['minigun', 'stomp', 'charge', 'explosive_rounds'] },
    ])
    this.maxHealth = 1500
    this.health = 1500
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 1 && !this.armourShed) {
      this.armourShed = true
      console.log('BossHeavy sheds armour — entering rage phase')
    }
  }
}
