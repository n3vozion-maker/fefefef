import type { WeaponDefinition } from './WeaponRegistry'

export interface Attachment {
  id: string
  slot: string
  damageBonus: number
  rangeBonus: number
  reloadBonus: number
}

export const AttachmentSystem = {
  apply(base: WeaponDefinition, attachments: Attachment[]): WeaponDefinition {
    const derived = { ...base }
    for (const att of attachments) {
      derived.damage += att.damageBonus
      derived.effectiveRange += att.rangeBonus
      derived.reloadTime = Math.max(0.5, derived.reloadTime - att.reloadBonus)
    }
    return derived
  },
}
