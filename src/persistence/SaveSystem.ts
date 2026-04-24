const SAVE_KEY = 'fps_save'

export interface SaveData {
  playerPos: { x: number; y: number; z: number }
  health: number
  ammo: Record<string, number>
  missionId: string | null
  completedObjectives: string[]
  playtime: number
}

export const SaveSystem = {
  save(data: SaveData): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  },

  load(): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as SaveData } catch { return null }
  },

  delete(): void {
    localStorage.removeItem(SAVE_KEY)
  },
}
