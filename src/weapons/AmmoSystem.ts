import type { AmmoType } from './WeaponRegistry'

export class AmmoSystem {
  private reserves = new Map<AmmoType, number>()

  setReserve(type: AmmoType, count: number): void {
    this.reserves.set(type, count)
  }

  consume(type: AmmoType, amount: number): boolean {
    const current = this.reserves.get(type) ?? 0
    if (current < amount) return false
    this.reserves.set(type, current - amount)
    return true
  }

  getReserve(type: AmmoType): number {
    return this.reserves.get(type) ?? 0
  }
}
