import * as THREE from 'three'
import { bus }    from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const CYCLE_DURATION  = 600       // seconds for a full 24h cycle
const HALF            = CYCLE_DURATION / 2

// Phase breakpoints (0–1 normalised time)
const DAWN_START  = 0.20
const DAY_START   = 0.27
const DUSK_START  = 0.72
const NIGHT_START = 0.80

// ── Colour palettes ───────────────────────────────────────────────────────────

const SKY_COLORS = {
  night: new THREE.Color(0x020409),
  dawn:  new THREE.Color(0xf4831f),
  day:   new THREE.Color(0x87ceeb),
  dusk:  new THREE.Color(0xe86a2a),
}

const FOG_COLORS = {
  night: new THREE.Color(0x040810),
  dawn:  new THREE.Color(0xb05030),
  day:   new THREE.Color(0xb0cfe0),
  dusk:  new THREE.Color(0x993322),
}

const SUN_COLORS = {
  night: new THREE.Color(0x101830),   // moon-blue ambient
  dawn:  new THREE.Color(0xff8c42),
  day:   new THREE.Color(0xfff5e0),
  dusk:  new THREE.Color(0xff6633),
}

// ── Helper: lerp Color ────────────────────────────────────────────────────────

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, THREE.MathUtils.clamp(t, 0, 1))
}

// ── DayNightSystem ────────────────────────────────────────────────────────────

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk'

export class DayNightSystem {
  private elapsed   = CYCLE_DURATION * 0.28   // start in early morning
  private _phase: DayPhase = 'day'
  private lastPhase: DayPhase = 'day'

  // Sun arc — radius in scene units
  private readonly SUN_R    = 800
  private readonly SUN_Y_OFFSET = 0

  constructor(
    private sun:      THREE.DirectionalLight,
    private ambient:  THREE.AmbientLight,
    private hemi:     THREE.HemisphereLight,
    private scene:    THREE.Scene,
    private fog:      THREE.FogExp2,
  ) {}

  update(dt: number): void {
    this.elapsed = (this.elapsed + dt) % CYCLE_DURATION
    const t = this.elapsed / CYCLE_DURATION   // 0–1

    // ── Phase detection ───────────────────────────────────────────────────────

    let phase: DayPhase
    let phaseT: number   // local blend within phase

    if (t < DAWN_START) {
      phase  = 'night'
      phaseT = t / DAWN_START
    } else if (t < DAY_START) {
      phase  = 'dawn'
      phaseT = (t - DAWN_START) / (DAY_START - DAWN_START)
    } else if (t < DUSK_START) {
      phase  = 'day'
      phaseT = (t - DAY_START) / (DUSK_START - DAY_START)
    } else if (t < NIGHT_START) {
      phase  = 'dusk'
      phaseT = (t - DUSK_START) / (NIGHT_START - DUSK_START)
    } else {
      phase  = 'night'
      phaseT = (t - NIGHT_START) / (1.0 - NIGHT_START)
    }

    this._phase = phase

    if (phase !== this.lastPhase) {
      this.lastPhase = phase
      bus.emit('dayPhaseChanged', { phase })
    }

    // ── Sun / moon arc ────────────────────────────────────────────────────────

    // angle: 0=sunrise(east), PI=sunset(west), PI..2PI=night arc below horizon
    const angle = t * Math.PI * 2
    const sinA  = Math.sin(angle)
    const cosA  = Math.cos(angle)

    this.sun.position.set(
      cosA  * this.SUN_R,
      sinA  * this.SUN_R + this.SUN_Y_OFFSET,
      -0.3  * this.SUN_R,
    )

    // ── Intensity ─────────────────────────────────────────────────────────────

    const sunAbove = Math.max(0, sinA)   // 0 when below horizon

    // Sunrise/sunset glow even near horizon
    const horizonGlow = Math.max(0, 1 - Math.abs(sinA) * 8)

    this.sun.intensity     = 0.08 + sunAbove * 2.2 + horizonGlow * 0.6
    this.ambient.intensity = 0.03 + sunAbove * 0.54   // near-zero at night
    this.hemi.intensity    = 0.02 + sunAbove * 0.42   // near-zero at night

    // ── Colours ───────────────────────────────────────────────────────────────

    let skyCol: THREE.Color
    let fogCol: THREE.Color
    let sunCol: THREE.Color

    if (phase === 'night') {
      skyCol = SKY_COLORS.night
      fogCol = FOG_COLORS.night
      sunCol = SUN_COLORS.night
    } else if (phase === 'dawn') {
      skyCol = lerpColor(SKY_COLORS.night, SKY_COLORS.dawn,  phaseT * 0.7).lerp(SKY_COLORS.day, phaseT * 0.4)
      fogCol = lerpColor(FOG_COLORS.night, FOG_COLORS.dawn,  phaseT)
      sunCol = lerpColor(SUN_COLORS.night, SUN_COLORS.dawn,  phaseT)
    } else if (phase === 'day') {
      skyCol = lerpColor(SKY_COLORS.dawn,  SKY_COLORS.day,   Math.min(1, phaseT * 4))
      fogCol = lerpColor(FOG_COLORS.dawn,  FOG_COLORS.day,   Math.min(1, phaseT * 4))
      sunCol = lerpColor(SUN_COLORS.dawn,  SUN_COLORS.day,   Math.min(1, phaseT * 3))
    } else {
      // dusk
      skyCol = lerpColor(SKY_COLORS.day,  SKY_COLORS.dusk,  phaseT)
        .lerp(SKY_COLORS.night, phaseT * 0.5)
      fogCol = lerpColor(FOG_COLORS.day,  FOG_COLORS.dusk,  phaseT)
      sunCol = lerpColor(SUN_COLORS.day,  SUN_COLORS.dusk,  phaseT)
    }

    this.scene.background = skyCol
    this.fog.color.copy(fogCol)
    this.sun.color.copy(sunCol)
    this.ambient.color.copy(sunCol.clone().multiplyScalar(0.7))

    // Fog: much thicker at night (visibility is the darkness mechanic)
    this.fog.density = 0.00040 + (1 - sunAbove) * 0.00110

    // Hemi sky/ground colours
    this.hemi.color.copy(skyCol)
    this.hemi.groundColor.copy(new THREE.Color(0x3a5f3a).lerp(new THREE.Color(0x101520), 1 - sunAbove))
  }

  // ── Public API ────────────────────────────────────────────────────────────

  get phase(): DayPhase { return this._phase }
  get isNight(): boolean { return this._phase === 'night' }

  /** 0=full dark, 1=full day — useful for AI sight range scaling */
  get brightness(): number {
    const t = this.elapsed / CYCLE_DURATION
    return THREE.MathUtils.clamp(Math.sin(t * Math.PI * 2), 0, 1)
  }

  /** Skip to a given normalised time (0–1) */
  setTime(t: number): void {
    this.elapsed = THREE.MathUtils.clamp(t, 0, 1) * CYCLE_DURATION
  }
}
