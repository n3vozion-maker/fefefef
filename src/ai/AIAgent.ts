import type { AlertState } from './SensorSystem'

export class AIAgent {
  alertState: AlertState = 'unaware'
  health = 100

  update(_dt: number): void {}

  applyDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount)
  }

  isDead(): boolean {
    return this.health <= 0
  }
}
