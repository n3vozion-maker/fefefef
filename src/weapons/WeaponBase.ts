import * as THREE from 'three'
import { bus } from '../core/EventBus'
import type { WeaponDefinition } from './WeaponRegistry'

export interface WeaponFiredPayload {
  origin:    THREE.Vector3
  direction: THREE.Vector3
  weapon:    WeaponBase
  damage?:   number   // override for shotgun pellets
}

export abstract class WeaponBase {
  protected stats:       WeaponDefinition
  protected ammoInMag:   number
  protected reserveAmmo: number
  protected isReloading  = false
  protected reloadTimer  = 0
  protected fireCooldown = 0

  abstract get isAutomatic(): boolean
  abstract get recoilPitch():  number   // radians per shot
  abstract get recoilYaw():    number   // radians per shot (random ±)

  constructor(definition: WeaponDefinition, reserveAmmo?: number) {
    this.stats        = { ...definition }
    this.ammoInMag    = definition.magazineSize
    this.reserveAmmo  = reserveAmmo ?? definition.magazineSize * 3
  }

  // ── Fire ──────────────────────────────────────────────────────────────────

  tryFire(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.fireCooldown > 0 || this.isReloading || this.ammoInMag <= 0) {
      if (this.ammoInMag <= 0 && !this.isReloading) this.startReload()
      return false
    }
    this.ammoInMag--
    this.fireCooldown = 60 / this.stats.rateOfFire
    this.onFire(origin, direction)
    return true
  }

  protected onFire(origin: THREE.Vector3, direction: THREE.Vector3): void {
    bus.emit<WeaponFiredPayload>('weaponFired', { origin, direction, weapon: this })
  }

  // ── Reload ────────────────────────────────────────────────────────────────

  startReload(): void {
    if (this.isReloading || this.ammoInMag === this.stats.magazineSize || this.reserveAmmo <= 0) return
    this.isReloading = true
    this.reloadTimer = this.stats.reloadTime
    bus.emit('reloadStart', this.stats.id)
  }

  // ── Aim ───────────────────────────────────────────────────────────────────

  aim(_active: boolean): void { /* consumed by PlayerController ADS state */ }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    if (this.isReloading) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) this.finishReload()
    }
  }

  private finishReload(): void {
    const needed = this.stats.magazineSize - this.ammoInMag
    const take   = Math.min(needed, this.reserveAmmo)
    this.ammoInMag   += take
    this.reserveAmmo -= take
    this.isReloading  = false
    bus.emit('reloadEnd', this.stats.id)
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  getAmmo():        number  { return this.ammoInMag }
  getReserve():     number  { return this.reserveAmmo }
  getMagSize():     number  { return this.stats.magazineSize }
  getIsReloading(): boolean { return this.isReloading }
  getStats():       WeaponDefinition { return this.stats }
  getId():          string  { return this.stats.id }
  getName():        string  { return this.stats.name }
  getCategory():    string  { return this.stats.category }
  getDamage():      number  { return this.stats.damage }
  getRoF():         number  { return this.stats.rateOfFire }

  addReserve(amount: number): void {
    this.reserveAmmo += amount
  }
}
