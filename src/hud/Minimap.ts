import * as THREE from 'three'
import { POI_DEFINITIONS, type PointOfInterest } from '../world/PointOfInterest'
import { bus } from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZE     = 180          // canvas px
const HALF     = SIZE / 2
const SCALE    = 0.10         // px per metre  →  900m radius shown
const BG       = 'rgba(8,12,8,0.82)'
const BORDER   = 'rgba(255,255,255,0.15)'

const POI_COLORS: Record<string, string> = {
  military_base:    '#ef5350',
  abandoned_village:'#ffa726',
  bunker:           '#ce93d8',
  outpost:          '#4fc3f7',
  crash_site:       '#90a4ae',
  checkpoint:       '#66bb6a',
}

// ── Minimap ───────────────────────────────────────────────────────────────────

export class Minimap {
  private canvas:  HTMLCanvasElement
  private ctx:     CanvasRenderingContext2D
  private pois     = POI_DEFINITIONS.slice()
  private objPos:  THREE.Vector3 | null = null   // active objective world pos
  private pulse    = 0

  constructor() {
    // ── Canvas element ────────────────────────────────────────────────────────
    this.canvas = document.createElement('canvas')
    this.canvas.width  = SIZE
    this.canvas.height = SIZE
    Object.assign(this.canvas.style, {
      position: 'fixed', top: '18px', right: '18px',
      width: `${SIZE}px`, height: `${SIZE}px`,
      borderRadius: '50%',
      border: '1px solid rgba(255,255,255,0.18)',
      pointerEvents: 'none', zIndex: '50',
      boxShadow: '0 2px 12px rgba(0,0,0,0.55)',
    })
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!

    // Listen for objective markers
    bus.on<{ targetPos: THREE.Vector3 }>('sideQuestStarted', (e) => {
      this.objPos = e.targetPos.clone()
    })
    bus.on('sideQuestCompleted', () => { this.objPos = null })

    // POI discovery
    bus.on<{ id: string }>('poiDiscovered', ({ id }) => {
      const p = this.pois.find(p => p.id === id)
      if (p) (p as PointOfInterest).discovered = true
    })
  }

  // ── Update / Draw ─────────────────────────────────────────────────────────

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    enemyPositions: THREE.Vector3[],
    activeMissionObjPos: THREE.Vector3 | null,
  ): void {
    this.pulse = (this.pulse + dt * 3) % (Math.PI * 2)
    const objTarget = this.objPos ?? activeMissionObjPos

    const ctx = this.ctx
    ctx.clearRect(0, 0, SIZE, SIZE)

    // ── Circular clip ─────────────────────────────────────────────────────────
    ctx.save()
    ctx.beginPath()
    ctx.arc(HALF, HALF, HALF - 1, 0, Math.PI * 2)
    ctx.clip()

    // Background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, SIZE, SIZE)

    // Grid lines (faint)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth   = 1
    for (let i = -4; i <= 4; i++) {
      const px = HALF + i * (SIZE / 8)
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, px); ctx.lineTo(SIZE, px); ctx.stroke()
    }

    // ── Helper: world → minimap px ────────────────────────────────────────────
    const toMap = (wx: number, wz: number): [number, number] => [
      HALF + (wx - playerPos.x) * SCALE,
      HALF + (wz - playerPos.z) * SCALE,
    ]

    // ── POIs ──────────────────────────────────────────────────────────────────
    for (const poi of this.pois) {
      const [mx, mz] = toMap(poi.x, poi.z)
      if (mx < -10 || mx > SIZE + 10 || mz < -10 || mz > SIZE + 10) continue

      const col = POI_COLORS[poi.type] ?? '#aaa'
      const r   = poi.type === 'military_base' ? 5 : poi.type === 'checkpoint' ? 3 : 4

      ctx.beginPath()
      ctx.arc(mx, mz, r, 0, Math.PI * 2)
      ctx.fillStyle   = poi.discovered ? col : col + '55'
      ctx.fill()

      if (poi.discovered) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth   = 1
        ctx.stroke()
      }
    }

    // ── Active objective (pulsing gold ring) ──────────────────────────────────
    if (objTarget) {
      const [mx, mz] = toMap(objTarget.x, objTarget.z)
      if (mx >= -20 && mx <= SIZE + 20 && mz >= -20 && mz <= SIZE + 20) {
        const pulseR = 6 + Math.sin(this.pulse) * 2
        ctx.beginPath()
        ctx.arc(mx, mz, pulseR, 0, Math.PI * 2)
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth   = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(mx, mz, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#ffd700'
        ctx.fill()
      }

      // Arrow on edge if off-map
      if (mx < 0 || mx > SIZE || mz < 0 || mz > SIZE) {
        this.drawEdgeArrow(ctx, playerPos, objTarget, '#ffd700')
      }
    }

    // ── Nearby enemies ────────────────────────────────────────────────────────
    for (const ep of enemyPositions) {
      const [mx, mz] = toMap(ep.x, ep.z)
      if (mx < 0 || mx > SIZE || mz < 0 || mz > SIZE) continue
      ctx.beginPath()
      ctx.arc(mx, mz, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ff3030'
      ctx.fill()
    }

    // ── Player marker ─────────────────────────────────────────────────────────
    ctx.save()
    ctx.translate(HALF, HALF)
    ctx.rotate(-playerYaw)
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(5, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(-5, 6)
    ctx.closePath()
    ctx.fillStyle   = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.lineWidth   = 1
    ctx.stroke()
    ctx.restore()

    ctx.restore()   // end circular clip

    // ── Border ring ───────────────────────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(HALF, HALF, HALF - 1, 0, Math.PI * 2)
    ctx.strokeStyle = BORDER
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // ── Scale label ───────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font      = '9px monospace'
    ctx.fillText('900m', SIZE - 40, SIZE - 8)
  }

  // ── Edge arrow for off-screen objective ───────────────────────────────────

  private drawEdgeArrow(
    ctx: CanvasRenderingContext2D,
    from: THREE.Vector3,
    to:   THREE.Vector3,
    color: string,
  ): void {
    const angle = Math.atan2(to.z - from.z, to.x - from.x)
    const margin = 12
    const ex = HALF + Math.cos(angle) * (HALF - margin)
    const ez = HALF + Math.sin(angle) * (HALF - margin)

    ctx.save()
    ctx.translate(ex, ez)
    ctx.rotate(angle + Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.restore()
  }

  setVisible(v: boolean): void {
    this.canvas.style.display = v ? 'block' : 'none'
  }
}
