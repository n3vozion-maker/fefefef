import type { AudioSystem } from './AudioSystem'
import { bus }              from '../core/EventBus'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MusicState = 'explore' | 'alert' | 'combat' | 'boss1' | 'boss2' | 'boss3'

interface Layer {
  osc:  OscillatorNode
  gain: GainNode
}

// ── MusicManager — procedural ambient using Web Audio API ─────────────────────
// Explore: a slow ambient drone (2–3 detuned oscillators + subtle noise wind)
// Combat:  that drone + a tense rhythmic pulse + rising tension oscillator
// Crossfades between states by ramping gain.

export class MusicManager {
  private ctx:         AudioContext | null = null
  private dest:        AudioNode    | null = null
  private state:       MusicState = 'explore'
  private combatTimer  = 0
  private alertTimer   = 0
  private stateTimer   = 0

  // Running layers
  private exploreLayers: Layer[]   = []
  private alertLayers:   Layer[]   = []
  private combatLayers:  Layer[]   = []
  private wind: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  private pulseIntervalId: ReturnType<typeof setInterval> | null = null

  private bossActive   = false
  private bossLayers:  Layer[]   = []
  private bossPulseId: ReturnType<typeof setInterval> | null = null

  constructor(private audio: AudioSystem) {
    bus.on('weaponFired',    () => { if (!this.bossActive) this.combatTimer = 14 })
    bus.on('agentDied',     () => { if (!this.bossActive) this.combatTimer = Math.max(this.combatTimer, 8) })
    bus.on('explosion',     () => { if (!this.bossActive) this.combatTimer = Math.max(this.combatTimer, 10) })
    bus.on('aiWeaponFired', () => { if (!this.bossActive) this.alertTimer  = Math.max(this.alertTimer,  10) })

    bus.on<{ intensity: string }>('bossMusic', ({ intensity }) => {
      if (intensity === 'phase1') this.startBoss(1)
      if (intensity === 'phase2') this.startBoss(2)
      if (intensity === 'phase3') this.startBoss(3)
    })
    bus.on('bossDied', () => {
      this.stopBoss()
      this.combatTimer = 18   // linger in combat after boss dies
    })
  }

  /** Called once AudioContext is available (after first user gesture) */
  start(ctx: AudioContext, dest: AudioNode): void {
    this.ctx  = ctx
    this.dest = dest
    this.buildExploreDrone()
    this.buildWind()
  }

  update(): void {
    if (this.bossActive) return   // boss music system takes full control

    const dt = 1 / 60
    if (this.combatTimer > 0) this.combatTimer -= dt
    if (this.alertTimer  > 0) this.alertTimer  -= dt
    this.stateTimer -= dt

    const desired: MusicState =
      this.combatTimer > 0 ? 'combat' :
      this.alertTimer  > 0 ? 'alert'  :
      'explore'
    if (desired !== this.state && this.stateTimer <= 0) {
      this.transition(desired)
      this.stateTimer = 3
    }
  }

  // ── Explore drone ─────────────────────────────────────────────────────────

  private buildExploreDrone(): void {
    const ctx  = this.ctx!
    const dest = this.dest!
    // Three detuned oscillators — low minor chord (A2 ~110Hz)
    const baseFreq  = 55     // A1 — very low rumble
    const detunes   = [0, 5, -4, 12]   // semitone offsets
    const types: OscillatorType[] = ['sine', 'sine', 'triangle', 'sine']

    this.exploreLayers = detunes.map((semi, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type      = types[i] ?? 'sine'
      osc.frequency.value = baseFreq * Math.pow(2, semi / 12)
      // Slow LFO on each oscillator
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.05 + i * 0.018
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.8
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start()

      gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(0.022 - i * 0.003, ctx.currentTime + 4)
      osc.connect(gain); gain.connect(dest)
      osc.start()
      return { osc, gain }
    })
  }

  private buildWind(): void {
    const ctx  = this.ctx!
    const dest = this.dest!
    // Pink-ish noise through very narrow bandpass for "wind" ambience
    const length = ctx.sampleRate * 4
    const buf    = ctx.createBuffer(1, length, ctx.sampleRate)
    const d      = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1
      // Pink noise filter coefficients
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
    const src  = ctx.createBufferSource()
    src.buffer = buf
    src.loop   = true
    const lp   = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 420
    const hp   = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 5)
    src.connect(lp); lp.connect(hp); hp.connect(gain); gain.connect(dest)
    src.start()
    this.wind = { src, gain }
  }

  // ── Alert layers (AI shooting, player not engaged yet) ───────────────────

  private startAlert(): void {
    const ctx  = this.ctx!
    const dest = this.dest!
    const t    = ctx.currentTime

    // Subtle rising tension — quiet and restrained vs full combat
    const tension = ctx.createOscillator()
    tension.type  = 'triangle'
    tension.frequency.setValueAtTime(68, t)
    tension.frequency.linearRampToValueAtTime(88, t + 20)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280
    const tg = ctx.createGain(); tg.gain.value = 0
    tg.gain.linearRampToValueAtTime(0.010, t + 2)
    tension.connect(lp); lp.connect(tg); tg.connect(dest)
    tension.start(t)
    this.alertLayers.push({ osc: tension, gain: tg })
  }

  private stopAlert(): void {
    const ctx = this.ctx
    if (!ctx) return
    for (const layer of this.alertLayers) {
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, ctx.currentTime)
      layer.gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 2)
      layer.osc.stop(ctx.currentTime + 2.2)
    }
    this.alertLayers = []
  }

  // ── Combat layers ─────────────────────────────────────────────────────────

  private startCombat(): void {
    const ctx  = this.ctx!
    const dest = this.dest!
    const t    = ctx.currentTime

    // Rising tension oscillator (slow upward sweep)
    const tension = ctx.createOscillator()
    tension.type  = 'sawtooth'
    tension.frequency.setValueAtTime(82, t)
    tension.frequency.linearRampToValueAtTime(110, t + 30)
    const tg = ctx.createGain(); tg.gain.value = 0
    tg.gain.linearRampToValueAtTime(0.018, t + 1.5)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
    tension.connect(lp); lp.connect(tg); tg.connect(dest)
    tension.start(t)
    this.combatLayers.push({ osc: tension, gain: tg })

    // Higher drone note (perfect 5th above base) for tension
    const fifth = ctx.createOscillator()
    fifth.type  = 'sine'
    fifth.frequency.value = 82.5   // ~E2
    const fg = ctx.createGain(); fg.gain.value = 0
    fg.gain.linearRampToValueAtTime(0.015, t + 2)
    fifth.connect(fg); fg.connect(dest)
    fifth.start(t)
    this.combatLayers.push({ osc: fifth, gain: fg })

    // Rhythmic pulse — low 2Hz thump using gain envelope on an oscillator
    this.pulseIntervalId = setInterval(() => {
      if (!this.ctx || this.state !== 'combat') return
      const tp  = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      osc.type  = 'sine'
      osc.frequency.value = 55
      const g  = this.ctx.createGain()
      g.gain.setValueAtTime(0.0, tp)
      g.gain.linearRampToValueAtTime(0.12, tp + 0.015)
      g.gain.exponentialRampToValueAtTime(0.001, tp + 0.22)
      osc.connect(g); g.connect(dest)
      osc.start(tp); osc.stop(tp + 0.25)
    }, 500)   // 2 Hz
  }

  private stopCombat(): void {
    if (this.pulseIntervalId !== null) {
      clearInterval(this.pulseIntervalId)
      this.pulseIntervalId = null
    }
    const ctx = this.ctx
    if (!ctx) return
    for (const layer of this.combatLayers) {
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, ctx.currentTime)
      layer.gain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 2.5)
      layer.osc.stop(ctx.currentTime + 2.6)
    }
    this.combatLayers = []
  }

  // ── Boss music ────────────────────────────────────────────────────────────

  private startBoss(phase: 1 | 2 | 3): void {
    const ctx  = this.ctx
    const dest = this.dest
    if (!ctx || !dest) return

    this.bossActive = true
    this.stopBoss()   // clear previous layers

    const t = ctx.currentTime

    // Core drone — distorted sawtooth, pitch rises each phase
    const baseFreq = phase === 1 ? 55 : phase === 2 ? 82 : 110
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = baseFreq
    const lp1  = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 800 + phase * 200
    const g1   = ctx.createGain(); g1.gain.value = 0
    g1.gain.linearRampToValueAtTime(0.025, t + 2)
    osc1.connect(lp1); lp1.connect(g1); g1.connect(dest); osc1.start(t)
    this.bossLayers.push({ osc: osc1, gain: g1 })

    // Fifth interval tension note
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'
    osc2.frequency.value = baseFreq * 1.5
    const g2 = ctx.createGain(); g2.gain.value = 0
    g2.gain.linearRampToValueAtTime(0.018, t + 1.5)
    osc2.connect(g2); g2.connect(dest); osc2.start(t)
    this.bossLayers.push({ osc: osc2, gain: g2 })

    // Phase 3: add harsh tritone (devil's interval)
    if (phase === 3) {
      const osc3 = ctx.createOscillator(); osc3.type = 'sawtooth'
      osc3.frequency.value = baseFreq * Math.pow(2, 6/12)   // tritone
      const dist3 = ctx.createWaveShaper()
      const curve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x))
      }
      dist3.curve = curve
      const g3 = ctx.createGain(); g3.gain.value = 0
      g3.gain.linearRampToValueAtTime(0.012, t + 1)
      osc3.connect(dist3); dist3.connect(g3); g3.connect(dest); osc3.start(t)
      this.bossLayers.push({ osc: osc3, gain: g3 })
    }

    // Rhythmic pulse — frequency doubles each phase (2/4/8 Hz)
    const pulseHz  = phase === 1 ? 500 : phase === 2 ? 250 : 125   // ms interval
    const pulseDmg = phase === 1 ? 0.13 : phase === 2 ? 0.18 : 0.24
    const pulseFreq = phase === 1 ? 55 : 82

    this.bossPulseId = setInterval(() => {
      if (!this.ctx || !this.bossActive) return
      const tp  = this.ctx.currentTime
      const osc = this.ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = pulseFreq
      const g   = this.ctx.createGain()
      g.gain.setValueAtTime(0.0, tp)
      g.gain.linearRampToValueAtTime(pulseDmg, tp + 0.012)
      g.gain.exponentialRampToValueAtTime(0.001, tp + 0.18)
      osc.connect(g); g.connect(dest); osc.start(tp); osc.stop(tp + 0.2)
    }, pulseHz)
  }

  private stopBoss(): void {
    if (this.bossPulseId !== null) { clearInterval(this.bossPulseId); this.bossPulseId = null }
    const ctx = this.ctx
    if (!ctx) return
    for (const l of this.bossLayers) {
      l.gain.gain.setValueAtTime(l.gain.gain.value, ctx.currentTime)
      l.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)
      l.osc.stop(ctx.currentTime + 2.2)
    }
    this.bossLayers  = []
    this.bossActive  = false
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  private transition(next: MusicState): void {
    const prev = this.state
    this.state = next
    const ctx  = this.ctx

    if (next === 'combat') {
      if (prev === 'alert') this.stopAlert()
      this.startCombat()
      for (const l of this.exploreLayers)
        l.gain.gain.linearRampToValueAtTime(l.gain.gain.value * 1.4, (ctx?.currentTime ?? 0) + 1)
    } else if (next === 'alert') {
      if (prev === 'combat') this.stopCombat()
      this.startAlert()
    } else {
      // explore
      this.stopCombat()
      this.stopAlert()
      if (ctx) {
        for (const l of this.exploreLayers)
          l.gain.gain.linearRampToValueAtTime(l.gain.gain.value / 1.4, ctx.currentTime + 2)
      }
    }
  }
}
