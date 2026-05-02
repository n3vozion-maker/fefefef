const STORAGE_KEY = 'pj1_settings_v1'

export interface GameSettings {
  mouseSensitivity:    number
  fov:                 number
  adsFov:              number
  adsSpeedMultiplier:  number
  masterVolume:        number
  musicVolume:         number
  sfxVolume:           number
  shadowQuality:       'low' | 'medium' | 'high'
  graphicsQuality:     'low' | 'medium' | 'high'
  invertY:             boolean
}

const DEFAULTS: GameSettings = {
  mouseSensitivity:   0.002,
  fov:                75,
  adsFov:             60,
  adsSpeedMultiplier: 0.7,
  masterVolume:       1.0,
  musicVolume:        1.0,
  sfxVolume:          1.0,
  shadowQuality:      'medium',
  graphicsQuality:    'medium',
  invertY:            false,
}

function persist(s: GameSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* quota */ }
}

// Load persisted values and merge with defaults
const _data: GameSettings = { ...DEFAULTS }
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) Object.assign(_data, JSON.parse(raw) as Partial<GameSettings>)
} catch { /* storage unavailable */ }

// Proxy auto-saves on every write
export const Settings = new Proxy(_data, {
  set(target, prop, value: unknown) {
    ;(target as unknown as Record<string, unknown>)[prop as string] = value
    persist(target)
    return true
  },
}) as GameSettings
