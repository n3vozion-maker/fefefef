import { bus }        from '../core/EventBus'
import { SaveSystem } from '../persistence/SaveSystem'

export class CashSystem {
  private _cash: number

  constructor() {
    this._cash = SaveSystem.loadProfile().cash ?? 0

    // Regular infantry kill reward
    bus.on('agentDied', () => {
      this.earn(20 + Math.floor(Math.random() * 26))   // $20–45
    })

    // Objective completion bonus (payload is the objective id string)
    bus.on<string>('objectiveCompleted', (id) => {
      if (typeof id === 'string' && (id.includes('eliminate') || id.includes('boss'))) {
        this.earn(500 + Math.floor(Math.random() * 501)) // $500–1000 boss kill
      } else {
        this.earn(100)  // reach/secure objective
      }
    })

    // Mission completion bonus
    bus.on('missionCompleted', () => {
      this.earn(250)
    })
  }

  get cash(): number { return this._cash }

  earn(amount: number): void {
    this._cash += amount
    bus.emit('cashChanged', this._cash)
    this._persist()
  }

  spend(amount: number): boolean {
    if (this._cash < amount) return false
    this._cash -= amount
    bus.emit('cashChanged', this._cash)
    this._persist()
    return true
  }

  private _persist(): void {
    const p = SaveSystem.loadProfile()
    p.cash = this._cash
    SaveSystem.saveProfile(p)
  }
}
