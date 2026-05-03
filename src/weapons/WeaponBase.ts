import * as THREE from 'three'
import { bus } from '../core/EventBus'
import type { WeaponDefinition, AttachmentSlot } from './WeaponRegistry'
import type { AttachmentDef } from './AttachmentRegistry'

export interface WeaponFiredPayload {
  origin:      THREE.Vector3
  direction:   THREE.Vector3
  weapon:      WeaponBase
  damage?:     number    // override for shotgun pellets
  suppressed?: boolean   // suppressor attached — limits enemy alerting radius
}

export abstract class WeaponBase {
  protected stats:       WeaponDefinition
  protected ammoInMag:   number
  protected reserveAmmo: number
  protected isReloading  = false
  protected reloadTimer  = 0
  protected fireCooldown = 0

  private _baseStats:   WeaponDefinition
  private _attachments  = new Map<AttachmentSlot, AttachmentDef>()
  private _recoilMult   = 1

  abstract get isAutomatic(): boolean
  abstract get recoilPitch():  number   // radians per shot
  abstract get recoilYaw():    number   // radians per shot (random ±)

  constructor(definition: WeaponDefinition, reserveAmmo?: number) {
    this._baseStats   = { ...definition }
    this.stats        = { ...definition }
    this.ammoInMag    = definition.magazineSize
    this.reserveAmmo  = reserveAmmo ?? definition.magazineSize * 3
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  equipAttachment(att: AttachmentDef): void {
    this._attachments.set(att.slot, att)
    this._recalcStats()
  }

  removeAttachment(slot: AttachmentSlot): void {
    this._attachments.delete(slot)
    this._recalcStats()
    this.ammoInMag = Math.min(this.ammoInMag, this.stats.magazineSize)
  }

  getAttachment(slot: AttachmentSlot): AttachmentDef | undefined {
    return this._attachments.get(slot)
  }

  getAttachments(): Map<AttachmentSlot, AttachmentDef> {
    return new Map(this._attachments)
  }

  get recoilMultiplier(): number { return this._recoilMult }

  private _recalcStats(): void {
    let dmgMult = 1, rangeMult = 1, rofMult = 1, reloadMult = 1, recoilMult = 1
    let magAdd = 0
    for (const att of this._attachments.values()) {
      dmgMult    *= att.damageMulti  ?? 1
      rangeMult  *= att.rangeMulti   ?? 1
      rofMult    *= att.rofMulti     ?? 1
      reloadMult *= att.reloadMulti  ?? 1
      recoilMult *= att.recoilMulti  ?? 1
      magAdd     += att.magAdd       ?? 0
    }
    this._recoilMult = recoilMult
    this.stats = {
      ...this._baseStats,
      damage:         Math.round(this._baseStats.damage * dmgMult),
      effectiveRange: Math.round(this._baseStats.effectiveRange * rangeMult),
      rateOfFire:     Math.round(this._baseStats.rateOfFire * rofMult),
      reloadTime:     this._baseStats.reloadTime * reloadMult,
      magazineSize:   this._baseStats.magazineSize + magAdd,
    }
  }

  // ── Fire ──────────────────────────────────────────────────────────────────

  tryFire(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.fireCooldown > 0 || this.isReloading || this.ammoInMag <= 0) {
      if (this.ammoInMag <= 0 && !this.isReloading) {
        bus.emit('dryFire', undefined)
        this.startReload()
      }
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

  getAmmo():           number  { return this.ammoInMag }
  getReserve():        number  { return this.reserveAmmo }
  getMagSize():        number  { return this.stats.magazineSize }
  getIsReloading():    boolean { return this.isReloading }
  getReloadProgress(): number  {
    if (!this.isReloading || this.stats.reloadTime <= 0) return 0
    return Math.max(0, Math.min(1, 1 - this.reloadTimer / this.stats.reloadTime))
  }
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
