import { WeaponRegistry } from '../WeaponRegistry'

WeaponRegistry.register({
  id: 'rifle_m4a1',
  name: 'M4A1',
  category: 'rifle',
  damage: 35,
  rateOfFire: 800,
  magazineSize: 30,
  reloadTime: 2.3,
  effectiveRange: 150,
  attachmentSlots: ['scope', 'muzzle', 'grip', 'magazine', 'underbarrel'],
  supportedAmmoTypes: ['standard', 'hollow-point', 'armor-piercing'],
})

WeaponRegistry.register({
  id: 'rifle_ak47',
  name: 'AK-47',
  category: 'rifle',
  damage: 42,
  rateOfFire: 600,
  magazineSize: 30,
  reloadTime: 2.8,
  effectiveRange: 120,
  attachmentSlots: ['scope', 'muzzle', 'grip', 'magazine'],
  supportedAmmoTypes: ['standard', 'armor-piercing'],
})
