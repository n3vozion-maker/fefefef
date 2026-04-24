export interface PlayerProfile {
  unlockedWeapons: string[]
  unlockedAttachments: string[]
  totalPlaytime: number
  settings: Record<string, unknown>
  stats: {
    kills: number
    deaths: number
    missionsComplete: number
  }
}

export function createDefaultProfile(): PlayerProfile {
  return {
    unlockedWeapons: ['rifle_m4a1', 'pistol_m9'],
    unlockedAttachments: [],
    totalPlaytime: 0,
    settings: {},
    stats: { kills: 0, deaths: 0, missionsComplete: 0 },
  }
}
