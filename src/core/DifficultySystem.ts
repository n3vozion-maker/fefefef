import { bus } from './EventBus'

// ── Difficulty ────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  enemyHpMult:     number   // multiplier applied to all AI hp at game start
  bossHpMult:      number   // multiplier applied to boss maxHealth
  enemyDamageMult: number   // applied to incoming AI damage in main.ts
  playerMaxHp:     number   // PlayerStats.maxHealth override
  label:           string
  color:           string
  description:     string
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    enemyHpMult:     0.55,
    bossHpMult:      0.60,
    enemyDamageMult: 0.45,
    playerMaxHp:     150,
    label:           'EASY',
    color:           '#66bb6a',
    description:     'More HP  ·  Enemies hit softer  ·  Boss HP ×0.6',
  },
  normal: {
    enemyHpMult:     1.00,
    bossHpMult:      1.00,
    enemyDamageMult: 1.00,
    playerMaxHp:     100,
    label:           'NORMAL',
    color:           '#ffa726',
    description:     'Balanced  ·  The intended experience',
  },
  hard: {
    enemyHpMult:     1.60,
    bossHpMult:      1.40,
    enemyDamageMult: 1.50,
    playerMaxHp:     75,
    label:           'HARD',
    color:           '#ef5350',
    description:     'Less HP  ·  Enemies hit harder  ·  Boss HP ×1.4',
  },
}

// ── DifficultySystem — singleton ──────────────────────────────────────────────

class DifficultySystemClass {
  private _current: Difficulty = 'normal'

  set(d: Difficulty): void {
    this._current = d
    bus.emit('difficultySet', d)
  }

  get current(): Difficulty { return this._current }
  get config(): DifficultyConfig { return DIFFICULTY_CONFIGS[this._current] }

  // Convenience getters
  get enemyHpMult():     number { return this.config.enemyHpMult }
  get bossHpMult():      number { return this.config.bossHpMult }
  get enemyDamageMult(): number { return this.config.enemyDamageMult }
  get playerMaxHp():     number { return this.config.playerMaxHp }
}

export const DifficultySystem = new DifficultySystemClass()
