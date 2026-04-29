const SAVE_KEY = 'fps_upgrades_v1'

export interface UpgradeTier {
  name:        string
  description: string
  cost:        number
}

export interface UpgradeDef {
  id:    string
  label: string
  tiers: UpgradeTier[]
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'health', label: 'MAX HEALTH',
    tiers: [
      { name: 'Field Medkit I',    description: '+15 max HP',       cost: 180 },
      { name: 'Field Medkit II',   description: '+30 max HP total', cost: 280 },
      { name: 'Field Medkit III',  description: '+45 max HP total', cost: 400 },
    ],
  },
  {
    id: 'armor', label: 'ARMOR',
    tiers: [
      { name: 'Light Vest',       description: '-8% incoming damage',  cost: 200 },
      { name: 'Heavy Vest',       description: '-16% incoming damage', cost: 320 },
      { name: 'Ballistic Plate',  description: '-24% incoming damage', cost: 480 },
    ],
  },
  {
    id: 'damage', label: 'WEAPON DAMAGE',
    tiers: [
      { name: 'AP Rounds I',   description: '+8% weapon damage',  cost: 220 },
      { name: 'AP Rounds II',  description: '+16% weapon damage', cost: 350 },
      { name: 'AP Rounds III', description: '+24% weapon damage', cost: 500 },
    ],
  },
  {
    id: 'stamina', label: 'STAMINA',
    tiers: [
      { name: 'Endurance I',   description: '+25 max stamina', cost: 150 },
      { name: 'Endurance II',  description: '+50 max stamina', cost: 250 },
      { name: 'Endurance III', description: '+75 max stamina', cost: 380 },
    ],
  },
]

export class UpgradeSystem {
  private tiers: Record<string, number> = {}

  constructor() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) this.tiers = JSON.parse(raw) as Record<string, number>
    } catch { /* */ }
    for (const d of UPGRADE_DEFS) {
      if (this.tiers[d.id] === undefined) this.tiers[d.id] = 0
    }
  }

  getTier(id: string):    number  { return this.tiers[id] ?? 0 }
  maxTier(id: string):    number  { return UPGRADE_DEFS.find(d => d.id === id)?.tiers.length ?? 0 }
  canUpgrade(id: string): boolean { return this.getTier(id) < this.maxTier(id) }

  nextCost(id: string): number {
    const tier = this.getTier(id)
    return UPGRADE_DEFS.find(d => d.id === id)?.tiers[tier]?.cost ?? Infinity
  }

  upgrade(id: string): boolean {
    if (!this.canUpgrade(id)) return false
    this.tiers[id] = (this.tiers[id] ?? 0) + 1
    this._save()
    return true
  }

  private _save(): void {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.tiers)) } catch { /* */ }
  }

  // ── Stat multipliers ──────────────────────────────────────────────────────
  get healthBonus():  number { return this.getTier('health')  * 15 }
  get armorMult():    number { return 1 - this.getTier('armor')   * 0.08 }
  get damageMult():   number { return 1 + this.getTier('damage')  * 0.08 }
  get staminaBonus(): number { return this.getTier('stamina') * 25 }
}
