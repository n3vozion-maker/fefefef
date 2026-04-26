import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'sniper_awp',
  name: 'AWP',
  category: 'sniper',
  damage: 120,
  rateOfFire: 40,
  magazineSize: 5,
  reloadTime: 3.5,
  effectiveRange: 600,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['standard', 'armor-piercing'],
})

WeaponRegistry.register({
  id: 'sniper_barrett',
  name: 'Barrett M82',
  category: 'sniper',
  damage: 180,
  rateOfFire: 25,
  magazineSize: 10,
  reloadTime: 4.2,
  effectiveRange: 900,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['armor-piercing'],
})
