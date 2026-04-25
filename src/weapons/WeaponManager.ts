import { bus } from '../core/EventBus'
import type { WeaponBase } from './WeaponBase'

export class WeaponManager {
  private slots:   (WeaponBase | null)[] = [null, null, null]
  private current  = 0
  private _isADS   = false

  init(): void {
    bus.on<string>('actionDown', (action) => {
      if (action === 'weapon1')   this.switchTo(0)
      if (action === 'weapon2')   this.switchTo(1)
      if (action === 'sidearm')   this.switchTo(2)
      if (action === 'reload')    this.activeWeapon()?.startReload()
    })
    bus.on<boolean>('adsChanged', (v) => { this._isADS = v })
  }

  equip(weapon: WeaponBase, slot: 0 | 1 | 2): void {
    this.slots[slot] = weapon
    bus.emit('weaponEquipped', { slot, weapon })
  }

  activeWeapon(): WeaponBase | null { return this.slots[this.current] ?? null }

  update(dt: number): void {
    this.activeWeapon()?.update(dt)
  }

  tryFire(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
  ): boolean {
    const w = this.activeWeapon()
    if (!w) return false
    const THREE = { Vector3: class {
      constructor(public x: number, public y: number, public z: number) {}
    }}
    // Use dynamic import to avoid circular — pass pre-built Three vectors from caller
    return w.tryFire(origin as never, direction as never)
  }

  switchTo(slot: number): void {
    if (slot < 0 || slot > 2 || !this.slots[slot]) return
    this.current = slot
    bus.emit('weaponSwitched', { slot, weapon: this.slots[slot] })
  }

  isADS(): boolean { return this._isADS }
}
