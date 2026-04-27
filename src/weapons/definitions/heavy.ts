import { WeaponRegistry } from '../WeaponRegistry'

// ── Side-quest reward weapons ─────────────────────────────────────────────────

WeaponRegistry.register({
  id: 'shotgun_aa12',
  name: 'AA-12 Auto',
  category: 'shotgun',
  damage: 52,
  rateOfFire: 300,
  magazineSize: 20,
  reloadTime: 2.8,
  effectiveRange: 18,
  attachmentSlots: ['muzzle', 'grip'],
  supportedAmmoTypes: ['standard'],
})

WeaponRegistry.register({
  id: 'smg_p90',
  name: 'P90',
  category: 'smg',
  damage: 26,
  rateOfFire: 900,
  magazineSize: 50,
  reloadTime: 2.2,
  effectiveRange: 30,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['standard', 'hollow-point'],
})

WeaponRegistry.register({
  id: 'sniper_dragunov',
  name: 'SVD Dragunov',
  category: 'sniper',
  damage: 90,
  rateOfFire: 90,
  magazineSize: 10,
  reloadTime: 3.2,
  effectiveRange: 280,
  attachmentSlots: ['scope', 'muzzle'],
  supportedAmmoTypes: ['standard', 'armor-piercing'],
})

WeaponRegistry.register({
  id: 'rifle_scar',
  name: 'SCAR-H',
  category: 'rifle',
  damage: 50,
  rateOfFire: 480,
  magazineSize: 20,
  reloadTime: 2.4,
  effectiveRange: 120,
  attachmentSlots: ['scope', 'muzzle', 'grip', 'underbarrel'],
  supportedAmmoTypes: ['standard', 'armor-piercing'],
})

WeaponRegistry.register({
  id: 'lmg_m249',
  name: 'M249 SAW',
  category: 'rifle',
  damage: 33,
  rateOfFire: 800,
  magazineSize: 100,
  reloadTime: 4.5,
  effectiveRange: 80,
  attachmentSlots: ['scope', 'grip'],
  supportedAmmoTypes: ['standard'],
})
