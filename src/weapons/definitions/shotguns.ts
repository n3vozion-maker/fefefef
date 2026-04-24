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
