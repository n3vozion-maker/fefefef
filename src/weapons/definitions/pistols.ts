import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'pistol_m9',
  name: 'M9',
  category: 'pistol',
  damage: 28,
  rateOfFire: 400,
  magazineSize: 15,
  reloadTime: 1.8,
  effectiveRange: 50,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['standard', 'hollow-point', 'subsonic'],
})

WeaponRegistry.register({
  id: 'pistol_desert_eagle',
  name: 'Desert Eagle',
  category: 'pistol',
  damage: 62,
  rateOfFire: 180,
  magazineSize: 7,
  reloadTime: 2.2,
  effectiveRange: 60,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['standard', 'armor-piercing'],
})
