import { bus } from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  '#ff3b3b', '#ff8c00', '#ffe400', '#00e676',
  '#00b0ff', '#e040fb', '#ff4081', '#69ff47',
  '#ffeb3b', '#40c4ff', '#ff6e40', '#b2ff59',
]

const GRAVITY        = 420    // px / s²
const PARTICLE_COUNT = 260
const DURATION       = 5.5    // seconds before canvas hides itself

// ── Particle ──────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number
  vx: number; vy: number
  w: number; h: number
  rot: number; rotSpeed: number
  color: string
  alpha: number
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// ── ConfettiSystem ────────────────────────────────────────────────────────────

export class ConfettiSystem {
  private canvas:    HTMLCanvasElement
  private ctx:       CanvasRenderingContext2D
  private particles: Particle[] = []
  private rafId:     number | null = null
  private lastTime   = 0
  private elapsed    = 0
  private running    = false

  constructor() {
    this.canvas = document.createElement('canvas')
    Object.assign(this.canvas.style, {
      position:      'fixed',
      inset:         '0',
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none',
      zIndex:        '180',
      display:       'none',
    })
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    bus.on('confettiFired', () => this.burst())

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  private resize(): void {
    this.canvas.width  = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  burst(): void {
    // Spawn particles from top-center fan
    const cx = this.canvas.width  * 0.5
    const cy = this.canvas.height * 0.25

    this.particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = rand(-Math.PI * 0.8, -Math.PI * 0.2) + rand(-0.4, 0.4)
      const speed = rand(300, 900)
      this.particles.push({
        x:        cx + rand(-80, 80),
        y:        cy,
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed,
        w:        rand(7, 16),
        h:        rand(4, 9),
        rot:      rand(0, Math.PI * 2),
        rotSpeed: rand(-8, 8),
        color:    COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#ff3b3b',
        alpha:    1,
      })
    }

    if (!this.running) {
      this.canvas.style.display = 'block'
      this.running  = true
      this.elapsed  = 0
      this.lastTime = performance.now()
      this.tick()
    } else {
      // Add more to existing burst
      this.elapsed = Math.min(this.elapsed, DURATION * 0.5 * 1000)
    }
  }

  private tick(): void {
    const now = performance.now()
    const dt  = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.elapsed += dt

    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const fadeStart = DURATION * 0.65
    const fadeLen   = DURATION - fadeStart

    for (const p of this.particles) {
      p.vy  += GRAVITY * dt
      p.x   += p.vx   * dt
      p.y   += p.vy   * dt
      p.rot += p.rotSpeed * dt
      // Air resistance
      p.vx  *= 1 - 0.9 * dt
      // Fade near end
      if (this.elapsed > fadeStart) {
        p.alpha = Math.max(0, 1 - (this.elapsed - fadeStart) / fadeLen)
      }
    }

    for (const p of this.particles) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = p.alpha
      ctx.fillStyle   = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }

    if (this.elapsed < DURATION) {
      this.rafId = requestAnimationFrame(() => this.tick())
    } else {
      this.stop()
    }
  }

  private stop(): void {
    this.running = false
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.canvas.style.display = 'none'
    this.particles = []
  }
}
