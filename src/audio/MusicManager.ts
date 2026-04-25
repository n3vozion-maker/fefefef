import { Howl } from 'howler'
import { bus }   from '../core/EventBus'

export type MusicState = 'explore' | 'stealth' | 'combat'

const TRACKS: Record<MusicState, string[]> = {
  explore: ['/assets/audio/music_explore.ogg'],
  stealth: ['/assets/audio/music_stealth.ogg'],
  combat:  ['/assets/audio/music_combat.ogg'],
}

const FADE_TIME = 1_500   // ms

export class MusicManager {
  private state:   MusicState = 'explore'
  private current: Howl | null = null
  private combatTimer = 0   // seconds since last combat event
  private stateTimer  = 0

  constructor() {
    bus.on('weaponFired', () => { this.combatTimer = 12 })
    bus.on('agentDied',   () => { this.combatTimer = Math.max(this.combatTimer, 6) })
    bus.on('wallRunStart',() => { /* stay on current */ })
  }

  update(): void {
    const dt = 1 / 60   // called each fixedUpdate tick
    if (this.combatTimer > 0) this.combatTimer -= dt

    const desired: MusicState = this.combatTimer > 0 ? 'combat' : 'explore'

    this.stateTimer -= dt
    if (desired !== this.state && this.stateTimer <= 0) {
      this.transition(desired)
      this.stateTimer = 2   // min seconds between transitions
    }
  }

  private transition(next: MusicState): void {
    if (this.current) this.current.fade(0.4, 0, FADE_TIME)
    this.state = next

    const src = TRACKS[next]
    if (!src) return

    const howl = new Howl({ src, loop: true, volume: 0, preload: true })
    howl.play()
    howl.fade(0, next === 'combat' ? 0.45 : 0.3, FADE_TIME)
    this.current = howl
  }
}
