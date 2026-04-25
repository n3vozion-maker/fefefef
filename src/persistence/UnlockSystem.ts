import { bus } from '../core/EventBus'

// ── Weapon unlock definitions ─────────────────────────────────────────────────

export type WeaponId =
  | 'rifle_m4a1'     // default — always unlocked
  | 'pistol_m9'      // default — always unlocked
  | 'sniper_awp'     // mission_1 complete
  | 'shotgun_spas'   // mission_2 complete
  | 'rifle_ak47'     // mission_3 complete
  | 'smg_mp5'        // mission_4 complete
  | 'sniper_barrett' // mission_5 complete

const MISSION_REWARDS: Record<string, WeaponId> = {
  mission_1: 'sniper_awp',
  mission_2: 'shotgun_spas',
  mission_3: 'rifle_ak47',
  mission_4: 'smg_mp5',
  mission_5: 'sniper_barrett',
}

const STORAGE_KEY = 'pj1_unlocks'

// ── UnlockSystem ──────────────────────────────────────────────────────────────

export class UnlockSystem {
  private unlocked: Set<WeaponId>

  constructor() {
    const saved = this.load()
    // Defaults always available
    this.unlocked = new Set<WeaponId>(['rifle_m4a1', 'pistol_m9', ...saved])

    // Listen for mission completion
    bus.on<{ missionId: string }>('missionCompleted', ({ missionId }) => {
      const reward = MISSION_REWARDS[missionId]
      if (reward && !this.unlocked.has(reward)) {
        this.unlock(reward)
        bus.emit('weaponUnlocked', { weaponId: reward })
      }
    })
  }

  unlock(id: WeaponId): void {
    this.unlocked.add(id)
    this.save()
  }

  isUnlocked(id: WeaponId): boolean {
    return this.unlocked.has(id)
  }

  getAll(): WeaponId[] {
    return Array.from(this.unlocked)
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]))
    } catch { /* */ }
  }

  private load(): WeaponId[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as WeaponId[]
    } catch { /* */ }
    return []
  }

  reset(): void {
    this.unlocked = new Set<WeaponId>(['rifle_m4a1', 'pistol_m9'])
    this.save()
  }
}
