const SAVE_KEY    = 'fps_save_v1'
const PROFILE_KEY = 'fps_profile_v1'

export interface SaveData {
  playerPos:           { x: number; y: number; z: number }
  health:              number
  ammo:                Record<string, number>
  missionId:           string | null
  completedObjectives: string[]
  playtime:            number
  timestamp:           number
}

export interface ProfileData {
  unlockedWeapons:     string[]
  unlockedAttachments: string[]
  cash:                number
  totalPlaytime:       number
  kills:               number
  deaths:              number
  missionsComplete:    number
}

export const SaveSystem = {
  save(data: SaveData): void {
    data.timestamp = Date.now()
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch { /* quota */ }
  },

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      return raw ? (JSON.parse(raw) as SaveData) : null
    } catch { return null }
  },

  delete(): void { localStorage.removeItem(SAVE_KEY) },

  // ── Profile (persists across saves) ────────────────────────────────────────

  saveProfile(p: ProfileData): void {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch { /* quota */ }
  },

  loadProfile(): ProfileData {
    try {
      const raw = localStorage.getItem(PROFILE_KEY)
      if (raw) return JSON.parse(raw) as ProfileData
    } catch { /* */ }
    return {
      unlockedWeapons:     ['rifle_m4a1', 'pistol_m9'],
      unlockedAttachments: [],
      cash:                0,
      totalPlaytime:       0,
      kills:               0,
      deaths:              0,
      missionsComplete:    0,
    }
  },
}
