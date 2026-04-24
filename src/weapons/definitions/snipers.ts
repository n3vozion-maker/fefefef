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
