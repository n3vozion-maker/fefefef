import * as THREE from 'three'

// ── Rain parameters ───────────────────────────────────────────────────────────

const RAIN_COUNT  = 1800
const H_RANGE     = 85     // horizontal radius around player
const TOP_OFFSET  = 28     // metres above player
const HEIGHT_SPAN = 40     // metres of fall column
const FALL_SPEED  = 32     // m/s

// ── Cycle timing (seconds) ────────────────────────────────────────────────────

const T_CLEAR    = 100
const T_BUILD    = 22
const T_RAIN     = 80
const T_FADE     = 18
const FULL_CYCLE = T_CLEAR + T_BUILD + T_RAIN + T_FADE

type Phase = 'clear' | 'building' | 'raining' | 'fading'

export class WeatherSystem {
  private inst:    THREE.InstancedMesh
  private dummy  = new THREE.Object3D()
  private phases: { dx: number; dz: number; phase: number }[] = []

  private elapsed   = 0
  private intensity = 0   // 0=dry, 1=full rain

  private rainNode:  AudioNode | null = null
  private rainGain:  GainNode  | null = null
  private audioCtx:  AudioContext | null = null

  constructor(
    private scene:  THREE.Scene,
    private fog:    THREE.FogExp2,
    private camera: THREE.Camera,
  ) {
    // Thin vertical streak geometry — tall box
    const geo = new THREE.BoxGeometry(0.028, 2.8, 0.028)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaaccff, transparent: true, opacity: 0.55,
      depthWrite: false,
    })
    this.inst = new THREE.InstancedMesh(geo, mat, RAIN_COUNT)
    this.inst.castShadow  = false
    this.inst.receiveShadow = false
    this.inst.visible     = false
    scene.add(this.inst)

    // Initialise each drop with a random local offset and fall phase
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.phases.push({
        dx:    (Math.random() - 0.5) * H_RANGE * 2,
        dz:    (Math.random() - 0.5) * H_RANGE * 2,
        phase: Math.random(),   // 0..1 position within fall column
      })
    }

    // Start rain partway into the cycle so it's not always dry on load
    this.elapsed = T_CLEAR * 0.6
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.elapsed = (this.elapsed + dt) % FULL_CYCLE

    const phase = this.getPhase()
    const targetIntensity = this.targetIntensity(phase)
    this.intensity += (targetIntensity - this.intensity) * Math.min(1, dt * 0.8)

    // Show/hide mesh
    this.inst.visible = this.intensity > 0.02

    if (this.inst.visible) {
      this.updateParticles(dt, playerPos)
    }

    // Add rain contribution on top of whatever DayNightSystem already set
    this.fog.density += this.intensity * 0.00080

    // Rain audio
    this.updateAudio()
  }

  private getPhase(): Phase {
    const t = this.elapsed
    if (t < T_CLEAR)                     return 'clear'
    if (t < T_CLEAR + T_BUILD)           return 'building'
    if (t < T_CLEAR + T_BUILD + T_RAIN)  return 'raining'
    return 'fading'
  }

  private targetIntensity(phase: Phase): number {
    const t = this.elapsed
    if (phase === 'clear')    return 0
    if (phase === 'building') return (t - T_CLEAR) / T_BUILD
    if (phase === 'raining')  return 1
    return 1 - (t - T_CLEAR - T_BUILD - T_RAIN) / T_FADE
  }

  private updateParticles(dt: number, playerPos: THREE.Vector3): void {
    const advance = dt * FALL_SPEED / HEIGHT_SPAN

    for (let i = 0; i < RAIN_COUNT; i++) {
      const p = this.phases[i]!
      p.phase = (p.phase + advance) % 1

      const wx = playerPos.x + p.dx
      const wy = playerPos.y + TOP_OFFSET - p.phase * HEIGHT_SPAN
      const wz = playerPos.z + p.dz

      this.dummy.position.set(wx, wy, wz)
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      this.inst.setMatrixAt(i, this.dummy.matrix)
    }
    this.inst.instanceMatrix.needsUpdate = true

    // Opacity driven by intensity
    ;(this.inst.material as THREE.MeshBasicMaterial).opacity = 0.28 + this.intensity * 0.40
  }

  // ── Procedural rain audio ─────────────────────────────────────────────────

  private updateAudio(): void {
    if (this.intensity > 0.05 && !this.rainNode) {
      this.startRainAudio()
    }
    if (this.rainGain) {
      const targetVol = this.intensity * 0.12
      try {
        const t = this.audioCtx!.currentTime
        this.rainGain.gain.setTargetAtTime(targetVol, t, 0.8)
      } catch { /* non-fatal */ }
    }
    if (this.intensity < 0.02 && this.rainNode) {
      this.stopRainAudio()
    }
  }

  private startRainAudio(): void {
    try {
      const ctx = new AudioContext()
      this.audioCtx = ctx
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
      const d   = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1

      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true

      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 2400
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600

      const gain = ctx.createGain(); gain.gain.value = 0
      src.connect(lp); lp.connect(hp); hp.connect(gain); gain.connect(ctx.destination)
      src.start()

      this.rainNode = src
      this.rainGain = gain
    } catch { /* audio unavailable */ }
  }

  private stopRainAudio(): void {
    try {
      if (this.rainGain && this.audioCtx) {
        const t = this.audioCtx.currentTime
        this.rainGain.gain.setValueAtTime(this.rainGain.gain.value, t)
        this.rainGain.gain.linearRampToValueAtTime(0, t + 1.5)
        const node = this.rainNode
        setTimeout(() => { try { (node as AudioBufferSourceNode).stop() } catch { /* */ } }, 1600)
      }
    } catch { /* */ }
    this.rainNode = null
    this.rainGain = null
    this.audioCtx = null
  }

  get isRaining(): boolean { return this.intensity > 0.3 }
  get rainIntensity(): number { return this.intensity }
}
