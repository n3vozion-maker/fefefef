export type AttachmentSlot = 'scope' | 'muzzle' | 'grip' | 'magazine' | 'underbarrel'
export type AmmoType = 'standard' | 'hollow-point' | 'armor-piercing' | 'subsonic' | 'explosive'

export interface WeaponDefinition {
  id: string
  name: string
  category: 'rifle' | 'smg' | 'pistol' | 'sniper' | 'shotgun' | 'explosive' | 'flag'
  damage: number
  rateOfFire: number
  magazineSize: number
  reloadTime: number
  effectiveRange: number
  attachmentSlots: AttachmentSlot[]
  supportedAmmoTypes: AmmoType[]
}

const catalogue = new Map<string, WeaponDefinition>()

export const WeaponRegistry = {
  register(def: WeaponDefinition): void {
    if (catalogue.has(def.id)) throw new Error(`Duplicate weapon id: ${def.id}`)
    catalogue.set(def.id, Object.freeze(def))
  },

  get(id: string): WeaponDefinition {
    const def = catalogue.get(id)
    if (!def) throw new Error(`Unknown weapon: ${id}`)
    return def
  },

  all(): WeaponDefinition[] {
    return [...catalogue.values()]
  },
}
