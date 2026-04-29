import { bus }          from '../core/EventBus'
import type { CashSystem } from '../economy/CashSystem'

const WINDOW_MS = 8_000   // kills within this window count

interface Tier {
  count:  number
  label:  string
  bonus:  number
}

const TIERS: Tier[] = [
  { count:  3, label: 'TRIPLE KILL',   bonus:  100 },
  { count:  5, label: 'RAMPAGE',       bonus:  300 },
  { count:  7, label: 'UNSTOPPABLE',   bonus:  600 },
  { count: 10, label: 'G O D L I K E', bonus: 1000 },
]

export class KillstreakSystem {
  private killTimes: number[] = []

  constructor(private cash: CashSystem) {
    bus.on('agentDied', () => this.onKill())
    bus.on('bossDied',  () => { this.onKill(); this.onKill(); this.onKill() }) // boss = 3 kills
  }

  private onKill(): void {
    const now = Date.now()
    this.killTimes.push(now)
    this.killTimes = this.killTimes.filter(t => now - t < WINDOW_MS)

    const count = this.killTimes.length
    // Only fire notification when crossing a tier threshold exactly
    const tier = TIERS.find(t => t.count === count)
    if (!tier) return

    this.cash.earn(tier.bonus)
    bus.emit('hudNotify', `${tier.label}  +$${tier.bonus}`)
    bus.emit('killstreak', { count })
  }
}
