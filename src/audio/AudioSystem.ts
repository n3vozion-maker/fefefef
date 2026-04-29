import { bus }          from '../core/EventBus'
import { MusicManager } from './MusicManager'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillNoise(buf: AudioBuffer): void {
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
}

function noise(ctx: AudioContext, durationSec: number): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durationSec), ctx.sampleRate)
  fillNoise(buf)
  const src = ctx.createBufferSource()
  src.buffer = buf
  return src
}

// ── Sound definitions (all procedural, no audio files needed) ─────────────────

type SoundFn = (ctx: AudioContext, dest: AudioNode) => void

const SOUNDS: Record<string, SoundFn> = {

  fire_rifle(ctx, dest) {
    const t  = ctx.currentTime
    // Noise body — crack
    const ns = noise(ctx, 0.12)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 2800
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.8, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
    ns.connect(lp); lp.connect(hp); hp.connect(ng); ng.connect(dest)
    ns.start(t)
    // Sub thump
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(170, t)
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.08)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.45, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.10)
    osc.connect(og); og.connect(dest)
    osc.start(t); osc.stop(t + 0.12)
  },

  fire_smg(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.07)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.55, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.065)
    ns.connect(lp); lp.connect(hp); hp.connect(ng); ng.connect(dest)
    ns.start(t)
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(240, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.055)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.28, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.07)
  },

  fire_pistol(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.08)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.62, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    ns.connect(lp); lp.connect(ng); ng.connect(dest)
    ns.start(t)
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(55, t + 0.065)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.32, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.07)
  },

  fire_sniper(ctx, dest) {
    const t  = ctx.currentTime
    // Sharp crack
    const ns = noise(ctx, 0.04)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(1.0, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    ns.connect(lp); lp.connect(ng); ng.connect(dest); ns.start(t)
    // Deep resonant boom
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(130, t); osc.frequency.exponentialRampToValueAtTime(28, t + 0.45)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.5)
    // Distant echo (quiet, slight delay)
    setTimeout(() => {
      try {
        const te = ctx.currentTime
        const ns2 = noise(ctx, 0.06)
        const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1200
        const ng2 = ctx.createGain()
        ng2.gain.setValueAtTime(0.12, te); ng2.gain.exponentialRampToValueAtTime(0.001, te + 0.06)
        ns2.connect(lp2); lp2.connect(ng2); ng2.connect(dest); ns2.start(te)
      } catch { /* ignore */ }
    }, 220)
  },

  fire_shotgun(ctx, dest) {
    // 3 overlapping noise blasts
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.013
      setTimeout(() => {
        try {
          const t2  = ctx.currentTime
          const ns2 = noise(ctx, 0.09)
          const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2000 + i * 180
          const ng2 = ctx.createGain()
          ng2.gain.setValueAtTime(0.5, t2); ng2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.085)
          ns2.connect(lp2); lp2.connect(ng2); ng2.connect(dest); ns2.start(t2)
        } catch { /* ignore */ }
      }, delay * 1000)
    }
    // Sub thump
    const t  = ctx.currentTime
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(95, t); osc.frequency.exponentialRampToValueAtTime(28, t + 0.16)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.55, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.18)
  },

  explosion(ctx, dest) {
    const t  = ctx.currentTime
    // Long noise tail
    const ns = noise(ctx, 2.5)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1600, t)
    lp.frequency.exponentialRampToValueAtTime(180, t + 2.0)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(1.0, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 2.2)
    ns.connect(lp); lp.connect(ng); ng.connect(dest); ns.start(t)
    // Sub-bass sweep
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(90, t); osc.frequency.exponentialRampToValueAtTime(18, t + 0.7)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.9)
    // Initial crack
    const crack = noise(ctx, 0.03)
    const hp2   = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 1000
    const cg    = ctx.createGain()
    cg.gain.setValueAtTime(0.7, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    crack.connect(hp2); hp2.connect(cg); cg.connect(dest); crack.start(t)
  },

  reload(ctx, dest) {
    // Two metallic clacks — magazine out then in
    for (let k = 0; k < 2; k++) {
      setTimeout(() => {
        try {
          const t2  = ctx.currentTime
          const ns2 = noise(ctx, 0.025)
          const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'
          bp.frequency.value = 1800 + k * 600; bp.Q.value = 12
          const g2  = ctx.createGain()
          g2.gain.setValueAtTime(0.28, t2); g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.022)
          ns2.connect(bp); bp.connect(g2); g2.connect(dest); ns2.start(t2)
        } catch { /* ignore */ }
      }, k * 240)
    }
  },

  dash(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.22)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(180, t + 0.18)
    bp.Q.value = 1.8
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.32, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    ns.connect(bp); bp.connect(ng); ng.connect(dest); ns.start(t)
  },

  parry(ctx, dest) {
    const t  = ctx.currentTime
    // Hit transient
    const ns = noise(ctx, 0.018)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.016)
    ns.connect(hp); hp.connect(ng); ng.connect(dest); ns.start(t)
    // Metallic ring — 4 harmonics
    const freqs = [1100, 2200, 3500, 5200]
    const vols  = [0.14, 0.10, 0.07, 0.05]
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f
      const og  = ctx.createGain()
      og.gain.setValueAtTime(vols[i] ?? 0.05, t)
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.4 - i * 0.05)
      osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.4)
    })
  },

  pickup(ctx, dest) {
    // Ascending chime: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((f, i) => {
      const t2  = ctx.currentTime + i * 0.075
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f
      // Harmonic overtone
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = f * 2
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0, t2)
      g.gain.linearRampToValueAtTime(0.15, t2 + 0.012)
      g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.18)
      const g2 = ctx.createGain()
      g2.gain.setValueAtTime(0.05, t2); g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12)
      osc.connect(g); osc2.connect(g2); g.connect(dest); g2.connect(dest)
      osc.start(t2); osc2.start(t2); osc.stop(t2 + 0.2); osc2.stop(t2 + 0.15)
    })
  },

  jump(ctx, dest) {
    const t  = ctx.currentTime
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(280, t); osc.frequency.exponentialRampToValueAtTime(520, t + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(g); g.connect(dest); osc.start(t); osc.stop(t + 0.1)
  },

  land(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.06)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
    const g  = ctx.createGain()
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.055)
    ns.connect(lp); lp.connect(g); g.connect(dest); ns.start(t)
  },

  hit_surface(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.035)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 4000
    const g  = ctx.createGain()
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    ns.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest); ns.start(t)
  },

  hit_flesh(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.028)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    const g  = ctx.createGain()
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.024)
    ns.connect(lp); lp.connect(g); g.connect(dest); ns.start(t)
  },

  victory_fanfare(ctx, dest) {
    // Ascending triumphant chord sequence: C4 – E4 – G4 – C5, then held chord
    const notes = [
      { f: 261.63, t: 0.00, dur: 0.35 },   // C4
      { f: 329.63, t: 0.12, dur: 0.35 },   // E4
      { f: 392.00, t: 0.24, dur: 0.35 },   // G4
      { f: 523.25, t: 0.36, dur: 0.7  },   // C5 (held)
      { f: 659.25, t: 0.44, dur: 0.6  },   // E5 (added)
      { f: 783.99, t: 0.52, dur: 0.55 },   // G5 (added)
    ]
    for (const n of notes) {
      const t2  = ctx.currentTime + n.t
      // Fundamental
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = n.f
      const g   = ctx.createGain()
      g.gain.setValueAtTime(0, t2)
      g.gain.linearRampToValueAtTime(0.18, t2 + 0.02)
      g.gain.setValueAtTime(0.18, t2 + n.dur - 0.08)
      g.gain.linearRampToValueAtTime(0, t2 + n.dur)
      osc.connect(g); g.connect(dest); osc.start(t2); osc.stop(t2 + n.dur + 0.05)
      // Octave overtone
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = n.f * 2
      const g2   = ctx.createGain()
      g2.gain.setValueAtTime(0, t2); g2.gain.linearRampToValueAtTime(0.06, t2 + 0.02)
      g2.gain.linearRampToValueAtTime(0, t2 + n.dur)
      osc2.connect(g2); g2.connect(dest); osc2.start(t2); osc2.stop(t2 + n.dur + 0.05)
    }
  },

  footstep(ctx, dest) {
    const t  = ctx.currentTime
    // Muffled thud — low noise burst
    const ns = noise(ctx, 0.04)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480
    const g  = ctx.createGain()
    g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
    ns.connect(lp); lp.connect(g); g.connect(dest); ns.start(t)
    // Subtle sub-thump
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(38, t + 0.045)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
    osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.05)
  },

  cash_pickup(ctx, dest) {
    // Two ascending coin tones
    const notes = [880, 1318.5]
    notes.forEach((f, i) => {
      const t2  = ctx.currentTime + i * 0.06
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f
      const g   = ctx.createGain()
      g.gain.setValueAtTime(0, t2)
      g.gain.linearRampToValueAtTime(0.12, t2 + 0.010)
      g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.14)
      osc.connect(g); g.connect(dest); osc.start(t2); osc.stop(t2 + 0.15)
    })
  },

  killstreak(ctx, dest) {
    // Punchy ascending triple beep
    const notes = [660, 880, 1100]
    notes.forEach((f, i) => {
      const t2  = ctx.currentTime + i * 0.075
      const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = f
      const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
      const g   = ctx.createGain()
      g.gain.setValueAtTime(0, t2)
      g.gain.linearRampToValueAtTime(0.09, t2 + 0.008)
      g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.09)
      osc.connect(lp); lp.connect(g); g.connect(dest); osc.start(t2); osc.stop(t2 + 0.10)
    })
  },

  slide(ctx, dest) {
    const t  = ctx.currentTime
    const ns = noise(ctx, 0.35)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(150, t + 0.3)
    bp.Q.value = 0.8
    const g  = ctx.createGain()
    g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
    ns.connect(bp); bp.connect(g); g.connect(dest); ns.start(t)
  },
}

// ── AudioSystem ───────────────────────────────────────────────────────────────

export class AudioSystem {
  private ctx:        AudioContext | null = null
  private masterGain: GainNode    | null = null
  readonly music:     MusicManager

  // Vehicle engine continuous sound
  private engineOsc:    OscillatorNode | null = null
  private engineGain:   GainNode       | null = null
  private engineActive  = false

  // Footstep cadence
  private footstepTimer = 0

  // Ambient sounds
  private ambientStarted   = false
  private distantFireTimer = 12 + Math.random() * 18

  constructor() {
    this.music = new MusicManager(this)

    // Web Audio requires a user gesture before context can be created
    const init = (): void => {
      this.ensureCtx()
      document.removeEventListener('click',   init)
      document.removeEventListener('keydown', init)
    }
    document.addEventListener('click',   init)
    document.addEventListener('keydown', init)

    this.bindEvents()
  }

  /** Returns (and creates on first call) the AudioContext */
  ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx        = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.75
      this.masterGain.connect(this.ctx.destination)
      this.music.start(this.ctx, this.masterGain)
    }
    return this.ctx
  }

  play(id: string): void {
    try {
      const ctx  = this.ensureCtx()
      const dest = this.masterGain ?? ctx.destination
      const fn   = SOUNDS[id]
      if (fn) fn(ctx, dest)
    } catch { /* audio errors are non-fatal */ }
  }

  update(
    _listenerPos: { x: number; y: number; z: number },
    _listenerFwd: { x: number; y: number; z: number },
    dt = 0,
  ): void {
    this.music.update()

    if (!this.ambientStarted && this.ctx) {
      this.startAmbientWind()
      this.ambientStarted = true
    }

    // Occasional distant gunfire ambience
    if (this.ambientStarted && dt > 0) {
      this.distantFireTimer -= dt
      if (this.distantFireTimer <= 0) {
        this.playDistantFire()
        this.distantFireTimer = 18 + Math.random() * 22
      }
    }
  }

  private startAmbientWind(): void {
    try {
      const ctx  = this.ensureCtx()
      const dest = this.masterGain ?? ctx.destination

      // Wind — bandpass-filtered looping noise with slow LFO gust
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
      fillNoise(buf)
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true

      const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 280; bp.Q.value = 0.6

      const wg  = ctx.createGain(); wg.gain.value = 0.028

      // Slow LFO for gusts (0.06 Hz)
      const lfo  = ctx.createOscillator(); lfo.frequency.value = 0.06
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.018
      lfo.connect(lfoG); lfoG.connect(wg.gain)
      lfo.start()

      src.connect(bp); bp.connect(wg); wg.connect(dest)
      src.start()
    } catch { /* non-fatal */ }
  }

  private playDistantFire(): void {
    try {
      const ctx  = this.ensureCtx()
      const dest = this.masterGain ?? ctx.destination
      const t    = ctx.currentTime

      const ns = noise(ctx, 0.08)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700
      const g  = ctx.createGain()
      g.gain.setValueAtTime(0.0, t)
      g.gain.linearRampToValueAtTime(0.07, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
      ns.connect(lp); lp.connect(g); g.connect(dest); ns.start(t)
    } catch { /* non-fatal */ }
  }

  /** Call every frame while player is on foot. Plays footstep thumps at cadence. */
  tickFootsteps(moving: boolean, grounded: boolean, sprinting: boolean, dt: number): void {
    if (!moving || !grounded) { this.footstepTimer = 0; return }
    const rate = sprinting ? 3.4 : 2.1
    this.footstepTimer -= dt
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 1 / rate
      this.play('footstep')
    }
  }

  /** Smoothly ramp engine oscillator frequency to match vehicle speed (m/s). */
  updateEngineSpeed(speed: number): void {
    if (!this.engineOsc || !this.ctx) return
    // idle ~70 Hz, full speed ~160 Hz
    const target = 70 + Math.min(speed, 28) * 3.2
    this.engineOsc.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.12)
    // volume up slightly with speed
    if (this.engineGain) {
      const vol = 0.07 + Math.min(speed, 28) * 0.001
      this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15)
    }
  }

  /** Set master volume 0-1. */
  setMasterVolume(v: number): void {
    if (this.masterGain) this.masterGain.gain.value = v * 0.75
  }

  // ── Vehicle engine ────────────────────────────────────────────────────────

  private startEngine(): void {
    if (this.engineActive) return
    this.engineActive = true
    const ctx  = this.ensureCtx()
    const dest = this.masterGain ?? ctx.destination

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 72

    // LFO for idle rumble
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 7
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 4
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
    lfo.start()

    const lp  = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280
    const g   = ctx.createGain(); g.gain.value = 0.001

    osc.connect(lp); lp.connect(g); g.connect(dest)
    osc.start()

    // Fade in
    g.gain.setValueAtTime(0.001, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.4)

    this.engineOsc  = osc
    this.engineGain = g
  }

  private stopEngine(): void {
    if (!this.engineActive) return
    this.engineActive = false
    const ctx = this.ctx
    if (!ctx || !this.engineGain || !this.engineOsc) return
    const g   = this.engineGain
    const osc = this.engineOsc
    this.engineOsc  = null
    this.engineGain = null
    const t = ctx.currentTime
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    setTimeout(() => { try { osc.stop() } catch { /* */ } }, 400)
  }

  // ── Event bindings ────────────────────────────────────────────────────────

  private bindEvents(): void {
    bus.on('playerJumped',   () => this.play('jump'))
    bus.on('playerLanded',   () => this.play('land'))
    bus.on('slideStart',     () => this.play('slide'))
    bus.on('dashUsed',       () => this.play('dash'))
    bus.on('parryStarted',   () => this.play('parry'))
    bus.on('reloadStart',    () => this.play('reload'))
    bus.on('ammoPickup',     () => this.play('pickup'))
    bus.on('vehicleEntered', () => { this.play('pickup'); this.startEngine() })
    bus.on('vehicleExited',  () => this.stopEngine())
    bus.on('vehicleDied',    () => this.stopEngine())
    bus.on('victoryAchieved',() => this.play('victory_fanfare'))
    bus.on('dropPickup',     () => this.play('cash_pickup'))
    bus.on('killstreak',     () => this.play('killstreak'))
    bus.on<number>('volumeChanged', (v) => this.setMasterVolume(v))

    bus.on<{ damage: number }>('damageEvent',  () => this.play('hit_flesh'))
    bus.on('bulletImpact', () => this.play('hit_surface'))

    bus.on<{ origin?: unknown }>('explosion',     () => this.play('explosion'))
    bus.on<{ origin?: unknown }>('grenadeThrown', () => this.play('explosion'))

    bus.on<{ weapon: { getCategory(): string } }>('weaponFired', (p) => {
      const cat = p.weapon.getCategory()
      const id  = cat === 'pistol'  ? 'fire_pistol'
                : cat === 'sniper'  ? 'fire_sniper'
                : cat === 'shotgun' ? 'fire_shotgun'
                : cat === 'smg'     ? 'fire_smg'
                : 'fire_rifle'
      this.play(id)
    })

    // Tank cannon fire
    bus.on('tankCannonFired', () => this.play('explosion'))
    bus.on('tankCoaxFired',   () => this.play('fire_rifle'))
  }
}
