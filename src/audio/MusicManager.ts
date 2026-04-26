import type { AudioSystem } from './AudioSystem'
import { bus }              from '../core/EventBus'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MusicState = 'explore' | 'combat'

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
  private stateTimer   = 0

  // Running layers
  private exploreLayers: Layer[]   = []
  private combatLayers:  Layer[]   = []
  private wind: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  private pulseIntervalId: ReturnType<typeof setInterval> | null = null

  constructor(private audio: AudioSystem) {
    bus.on('weaponFired', () => { this.combatTimer = 14 })
    bus.on('agentDied',   () => { this.combatTimer = Math.max(this.combatTimer, 8) })
    bus.on('explosion',   () => { this.combatTimer = Math.max(this.combatTimer, 10) })
  }

  /** Called once AudioContext is available (after first user gesture) */
  start(ctx: AudioContext, dest: AudioNode): void {
    this.ctx  = ctx
    this.dest = dest
    this.buildExploreDrone()
    this.buildWind()
  }

  update(): void {
    const dt = 1 / 60
    if (this.combatTimer > 0) this.combatTimer -= dt
    this.stateTimer -= dt

    const desired: MusicState = this.combatTimer > 0 ? 'combat' : 'explore'
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

  // ── Transitions ───────────────────────────────────────────────────────────

  private transition(next: MusicState): void {
    this.state = next
    if (next === 'combat') {
      this.startCombat()
      // Slightly lift explore drone volume during combat
      for (const l of this.exploreLayers) {
        l.gain.gain.linearRampToValueAtTime(
          l.gain.gain.value * 1.4,
          (this.ctx?.currentTime ?? 0) + 1,
        )
      }
    } else {
      this.stopCombat()
      // Bring explore drone back to normal
      const ctx = this.ctx
      if (ctx) {
        for (const l of this.exploreLayers) {
          l.gain.gain.linearRampToValueAtTime(
            l.gain.gain.value / 1.4,
            ctx.currentTime + 2,
          )
        }
      }
    }
  }
}
