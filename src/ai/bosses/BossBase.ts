export type BossPhase = { healthThreshold: number; abilities: string[] }

export abstract class BossBase {
  health = 1000
  maxHealth = 1000
  protected currentPhase = 0

  constructor(protected phases: BossPhase[]) {}

  update(_dt: number): void {
    this.evaluatePhase()
  }

  applyDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount)
  }

  isDead(): boolean { return this.health <= 0 }

  private evaluatePhase(): void {
    const ratio = this.health / this.maxHealth
    for (let i = this.phases.length - 1; i >= 0; i--) {
      const phase = this.phases[i]
      if (phase && ratio <= phase.healthThreshold && this.currentPhase < i) {
        this.currentPhase = i
        this.onPhaseChange(i)
        break
      }
    }
  }

  protected abstract onPhaseChange(phase: number): void
}
