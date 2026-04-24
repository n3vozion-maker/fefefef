import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'explosive_rpg7',
  name: 'RPG-7',
  category: 'explosive',
  damage: 300,
  rateOfFire: 10,
  magazineSize: 1,
  reloadTime: 5.0,
  effectiveRange: 200,
  attachmentSlots: [],
  supportedAmmoTypes: ['explosive'],
})

WeaponRegistry.register({
  id: 'explosive_grenade',
  name: 'Frag Grenade',
  category: 'explosive',
  damage: 150,
  rateOfFire: 30,
  magazineSize: 1,
  reloadTime: 0,
  effectiveRange: 30,
  attachmentSlots: [],
  supportedAmmoTypes: ['explosive'],
})
