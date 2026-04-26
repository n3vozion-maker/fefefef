import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'shotgun_870',
  name: 'Remington 870',
  category: 'shotgun',
  damage: 90,
  rateOfFire: 60,
  magazineSize: 6,
  reloadTime: 3.0,
  effectiveRange: 25,
  attachmentSlots: ['muzzle', 'grip'],
  supportedAmmoTypes: ['standard', 'hollow-point', 'explosive'],
})

WeaponRegistry.register({
  id: 'shotgun_spas',
  name: 'SPAS-12',
  category: 'shotgun',
  damage: 110,
  rateOfFire: 80,
  magazineSize: 8,
  reloadTime: 2.5,
  effectiveRange: 20,
  attachmentSlots: ['muzzle', 'grip'],
  supportedAmmoTypes: ['standard', 'hollow-point', 'explosive'],
})
