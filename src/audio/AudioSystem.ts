import { Howl, Howler } from 'howler'
import { bus }           from '../core/EventBus'
import { Settings }      from '../core/Settings'
import { MusicManager }  from './MusicManager'

interface SoundDef { src: string[]; volume?: number; loop?: boolean }

// ── Sound catalogue ───────────────────────────────────────────────────────────
// Paths relative to /public/assets/audio/ — swap in real files as they're added
const SOUNDS: Record<string, SoundDef> = {
  // Weapons (placeholders — replace src with real asset paths)
  'fire_rifle':   { src: ['/assets/audio/fire_rifle.ogg'],   volume: 0.7 },
  'fire_pistol':  { src: ['/assets/audio/fire_pistol.ogg'],  volume: 0.65 },
  'fire_sniper':  { src: ['/assets/audio/fire_sniper.ogg'],  volume: 0.9 },
  'fire_shotgun': { src: ['/assets/audio/fire_shotgun.ogg'], volume: 0.8 },
  'reload':       { src: ['/assets/audio/reload.ogg'],        volume: 0.5 },
  // Player
  'jump':         { src: ['/assets/audio/jump.ogg'],          volume: 0.4 },
  'land':         { src: ['/assets/audio/land.ogg'],          volume: 0.5 },
  'slide':        { src: ['/assets/audio/slide.ogg'],         volume: 0.4 },
  'wallrun':      { src: ['/assets/audio/wallrun.ogg'],       volume: 0.45 },
  // Combat
  'hit_flesh':    { src: ['/assets/audio/hit_flesh.ogg'],    volume: 0.6 },
  'explosion':    { src: ['/assets/audio/explosion.ogg'],    volume: 0.85 },
}

export class AudioSystem {
  readonly music: MusicManager
  private pool  = new Map<string, Howl>()
  private ready = false

  constructor() {
    this.music = new MusicManager()
    Howler.volume(Settings.masterVolume)

    // Pre-load sounds (silently fails if files missing — graceful degradation)
    for (const [id, def] of Object.entries(SOUNDS)) {
      const howl = new Howl({ src: def.src, volume: def.volume ?? 0.5, loop: def.loop ?? false, preload: true })
      this.pool.set(id, howl)
    }
    this.ready = true

    this.bindEvents()
  }

  play(id: string, pos?: { x: number; y: number; z: number }): void {
    if (!this.ready) return
    const howl = this.pool.get(id)
    if (!howl) return

    if (pos) {
      howl.pos(pos.x, pos.y, pos.z)
      howl.pannerAttr({ panningModel: 'HRTF', rolloffFactor: 1.2, refDistance: 5 })
    }
    howl.play()
  }

  update(listenerPos: { x: number; y: number; z: number }, listenerFwd: { x: number; y: number; z: number }): void {
    Howler.pos(listenerPos.x, listenerPos.y, listenerPos.z)
    Howler.orientation(listenerFwd.x, listenerFwd.y, listenerFwd.z, 0, 1, 0)
    this.music.update()
  }

  // ── Event bindings ─────────────────────────────────────────────────────────

  private bindEvents(): void {
    bus.on('playerJumped',   () => this.play('jump'))
    bus.on('slideStart',     () => this.play('slide'))
    bus.on('wallRunStart',   () => this.play('wallrun'))
    bus.on('reloadStart',    () => this.play('reload'))

    bus.on<{ agentId: string; damage: number }>('damageEvent', (e) => {
      void e
      this.play('hit_flesh')
    })

    bus.on<{ origin: { x:number;y:number;z:number } }>('grenadeThrown', (e) => {
      this.play('explosion', e.origin)
    })

    // Weapon fire sounds
    bus.on<{ weapon: { getStats(): { category: string } } }>('weaponFired', (p) => {
      const cat = p.weapon.getStats().category
      const id  = cat === 'pistol' ? 'fire_pistol'
                : cat === 'sniper' ? 'fire_sniper'
                : cat === 'shotgun' ? 'fire_shotgun'
                : 'fire_rifle'
      this.play(id)
    })
  }
}
