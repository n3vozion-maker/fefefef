import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'smg_mp5',
  name: 'MP5',
  category: 'smg',
  damage: 22,
  rateOfFire: 900,
  magazineSize: 30,
  reloadTime: 1.9,
  effectiveRange: 60,
  attachmentSlots: ['scope', 'muzzle', 'grip'],
  supportedAmmoTypes: ['standard', 'hollow-point'],
})
