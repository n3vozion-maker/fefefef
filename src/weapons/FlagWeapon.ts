import * as THREE  from 'three'
import { WeaponBase } from './WeaponBase'
import { bus }        from '../core/EventBus'

// ── FlagWeapon ────────────────────────────────────────────────────────────────
// The Victory Flag — shoots confetti, deals no damage, unlimited "ammo".
// Awarded after all 5 missions are complete.

const FLAG_DEF = {
  id:                 'flag_victory',
  name:               'Flag of Victory',
  category:           'flag'  as const,
  damage:             0,
  rateOfFire:         80,      // ~0.75s between bursts
  magazineSize:       999,
  reloadTime:         0,
  effectiveRange:     0,
  attachmentSlots:    [] as never[],
  supportedAmmoTypes: [] as never[],
}

export class FlagWeapon extends WeaponBase {
  override get isAutomatic(): boolean { return false }
  override get recoilPitch():  number  { return 0 }
  override get recoilYaw():    number  { return 0 }

  constructor() {
    super(FLAG_DEF, 999)
    this.ammoInMag   = 999
    this.reserveAmmo = 999
  }

  // Never runs out, never reloads
  override tryFire(_origin: THREE.Vector3, _dir: THREE.Vector3): boolean {
    if (this.fireCooldown > 0) return false
    this.fireCooldown = 60 / FLAG_DEF.rateOfFire
    bus.emit('confettiFired', {})
    bus.emit('weaponFired', { origin: _origin, direction: _dir, weapon: this, damage: 0 })
    return true
  }

  override startReload(): void { /* noop — infinite confetti */ }
  override getAmmo():    number { return 999 }
  override getReserve(): number { return 999 }
}
