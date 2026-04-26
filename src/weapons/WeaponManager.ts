import { bus }             from '../core/EventBus'
import type { WeaponBase } from './WeaponBase'
import { FirearmWeapon }   from './FirearmWeapon'

// ── Ammo type → weapon category mapping ──────────────────────────────────────

const AMMO_TO_CATEGORIES: Record<string, string[]> = {
  rifle:     ['rifle', 'smg'],
  pistol:    ['pistol'],
  sniper:    ['sniper'],
  explosive: ['shotgun', 'explosive'],
}

// ── WeaponManager ─────────────────────────────────────────────────────────────
// Manages 3 equipped slots (1/2/3) + an unlimited inventory (backpack).
// Weapons can be swapped between slots and backpack freely.

export class WeaponManager {
  /** The 3 hot-bar slots — null means empty */
  readonly slots: (WeaponBase | null)[] = [null, null, null]

  /** Backpack — all weapons NOT in a slot */
  readonly backpack: WeaponBase[] = []

  private current = 0
  private _isADS  = false

  // ── Init ────────────────────────────────────────────────────────────────────

  init(): void {
    bus.on<string>('actionDown', (a) => {
      if (a === 'weapon1') this.switchTo(0)
      if (a === 'weapon2') this.switchTo(1)
      if (a === 'sidearm') this.switchTo(2)
      if (a === 'reload')  this.activeWeapon()?.startReload()
    })

    bus.on<boolean>('adsChanged', (v) => { this._isADS = v })

    // Ammo pickup → top up matching weapons everywhere
    bus.on<{ type: string; amount: number }>('ammoPickup', ({ type, amount }) => {
      const cats = AMMO_TO_CATEGORIES[type] ?? []
      for (const w of this.allWeapons()) {
        if (cats.includes(w.getCategory())) w.addReserve(amount)
      }
    })

    // Weapon unlock → add to backpack
    bus.on<{ weaponId: string }>('weaponUnlocked', ({ weaponId }) => {
      if (this.allWeapons().some(w => w.getId() === weaponId)) return
      this.backpack.push(new FirearmWeapon(weaponId))
      bus.emit('loadoutChanged', undefined)
    })
  }

  // ── Equip helpers (used at game start) ─────────────────────────────────────

  equip(weapon: WeaponBase, slot: 0 | 1 | 2): void {
    const prev = this.slots[slot]
    if (prev) this.backpack.push(prev)
    this.slots[slot] = weapon
    bus.emit('weaponEquipped', { slot, weapon })
    bus.emit('loadoutChanged', undefined)
  }

  // ── Swap: backpack ↔ slot ──────────────────────────────────────────────────

  /** Move backpack[backpackIndex] into slot, pushing any current slot weapon into backpack */
  swapBackpackIntoSlot(backpackIndex: number, slot: 0 | 1 | 2): void {
    const incoming = this.backpack[backpackIndex]
    if (!incoming) return

    const displaced = this.slots[slot]
    this.slots[slot] = incoming
    this.backpack.splice(backpackIndex, 1)
    if (displaced) this.backpack.push(displaced)

    if (slot === this.current) bus.emit('weaponSwitched', { slot, weapon: incoming })
    bus.emit('weaponEquipped', { slot, weapon: incoming })
    bus.emit('loadoutChanged', undefined)
  }

  /** Move slot weapon into backpack (holster), leaving slot empty */
  holsterSlot(slot: 0 | 1 | 2): void {
    const w = this.slots[slot]
    if (!w) return
    this.slots[slot] = null
    this.backpack.push(w)
    bus.emit('loadoutChanged', undefined)
  }

  /** Swap two equipped slots */
  swapSlots(a: 0 | 1 | 2, b: 0 | 1 | 2): void {
    const tmp = this.slots[a] ?? null
    this.slots[a] = this.slots[b] ?? null
    this.slots[b] = tmp
    bus.emit('loadoutChanged', undefined)
  }

  // ── Runtime ─────────────────────────────────────────────────────────────────

  switchTo(slot: number): void {
    if (slot < 0 || slot > 2 || !this.slots[slot]) return
    this.current = slot
    bus.emit('weaponSwitched', { slot, weapon: this.slots[slot] })
  }

  update(dt: number): void { this.activeWeapon()?.update(dt) }

  activeWeapon():    WeaponBase | null { return this.slots[this.current] ?? null }
  getCurrentSlot():  number            { return this.current }
  isADS():           boolean           { return this._isADS }

  private allWeapons(): WeaponBase[] {
    return [
      ...(this.slots.filter(Boolean) as WeaponBase[]),
      ...this.backpack,
    ]
  }
}
