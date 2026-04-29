import type { AttachmentSlot } from './WeaponRegistry'

export interface AttachmentDef {
  id:           string
  name:         string
  slot:         AttachmentSlot
  cost:         number
  description:  string
  damageMulti?: number
  rangeMulti?:  number
  rofMulti?:    number
  magAdd?:      number
  reloadMulti?: number
  recoilMulti?: number
}

export const ATTACHMENTS: AttachmentDef[] = [
  // ── Scope ──────────────────────────────────────────────────────────────────────
  { id: 'red_dot',      name: 'Red Dot Sight',      slot: 'scope',       cost:  150, description: '+10% range · tighter recoil',              rangeMulti: 1.10, recoilMulti: 0.90 },
  { id: 'holo',         name: 'Holographic Sight',   slot: 'scope',       cost:  180, description: '+5% fire rate · tighter recoil',            rofMulti: 1.05, recoilMulti: 0.88 },
  { id: 'acog',         name: 'ACOG 4×',             slot: 'scope',       cost:  250, description: '+40% range · less recoil',                  rangeMulti: 1.40, recoilMulti: 0.85 },
  { id: 'sniper_scope', name: '8× Sniper Scope',     slot: 'scope',       cost:  350, description: '+80% range · much less recoil',             rangeMulti: 1.80, recoilMulti: 0.80 },
  { id: 'thermal',      name: 'Thermal Scope',        slot: 'scope',       cost:  500, description: '+50% range · +5% damage',                  rangeMulti: 1.50, damageMulti: 1.05, recoilMulti: 0.82 },

  // ── Muzzle ─────────────────────────────────────────────────────────────────────
  { id: 'flash_hider',  name: 'Flash Hider',          slot: 'muzzle',      cost:   80, description: '-12% recoil',                              recoilMulti: 0.88 },
  { id: 'compensator',  name: 'Compensator',           slot: 'muzzle',      cost:  100, description: '-20% recoil',                              recoilMulti: 0.80 },
  { id: 'muzzle_brake', name: 'Muzzle Brake',          slot: 'muzzle',      cost:  120, description: '-30% recoil',                              recoilMulti: 0.70 },
  { id: 'suppressor',   name: 'Suppressor',            slot: 'muzzle',      cost:  200, description: '-25% recoil · -10% range · -5% damage',    recoilMulti: 0.75, rangeMulti: 0.90, damageMulti: 0.95 },

  // ── Grip ───────────────────────────────────────────────────────────────────────
  { id: 'vertical_grip',name: 'Vertical Grip',        slot: 'grip',        cost:   80, description: '-15% recoil',                              recoilMulti: 0.85 },
  { id: 'angled_grip',  name: 'Angled Grip',           slot: 'grip',        cost:  100, description: '-20% recoil · +5% fire rate',              recoilMulti: 0.80, rofMulti: 1.05 },
  { id: 'bipod',        name: 'Bipod',                 slot: 'grip',        cost:  150, description: '-40% recoil · +20% range',                 recoilMulti: 0.60, rangeMulti: 1.20 },

  // ── Magazine ───────────────────────────────────────────────────────────────────
  { id: 'ext_mag',      name: 'Extended Magazine',    slot: 'magazine',    cost:  120, description: '+10 rounds',                               magAdd: 10 },
  { id: 'drum_mag',     name: 'Drum Magazine',         slot: 'magazine',    cost:  250, description: '+25 rounds · +35% reload time',            magAdd: 25, reloadMulti: 1.35 },
  { id: 'fast_mag',     name: 'Fast Magazine',         slot: 'magazine',    cost:  160, description: '-35% reload time',                         reloadMulti: 0.65 },
  { id: 'hp_ammo',      name: 'Hollow-Point Rounds',  slot: 'magazine',    cost:  180, description: '+20% damage · -15% range',                 damageMulti: 1.20, rangeMulti: 0.85 },

  // ── Underbarrel ────────────────────────────────────────────────────────────────
  { id: 'laser',        name: 'Laser Sight',           slot: 'underbarrel', cost:  100, description: '-18% recoil',                              recoilMulti: 0.82 },
  { id: 'flashlight',   name: 'Tactical Flashlight',   slot: 'underbarrel', cost:   80, description: '+15% damage',                              damageMulti: 1.15 },
  { id: 'gl',           name: 'Grenade Launcher',       slot: 'underbarrel', cost:  400, description: '+20% damage · -10% recoil',               damageMulti: 1.20, recoilMulti: 0.90 },
  { id: 'ub_bipod',     name: 'Underbarrel Bipod',     slot: 'underbarrel', cost:  130, description: '-35% recoil · +15% range',                 recoilMulti: 0.65, rangeMulti: 1.15 },
]

export const AttachmentRegistry = {
  getAll():                   AttachmentDef[]            { return ATTACHMENTS },
  get(id: string):            AttachmentDef | undefined  { return ATTACHMENTS.find(a => a.id === id) },
  bySlot(slot: AttachmentSlot): AttachmentDef[]          { return ATTACHMENTS.filter(a => a.slot === slot) },
}
