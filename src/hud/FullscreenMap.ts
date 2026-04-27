import * as THREE from 'three'
import { POI_DEFINITIONS } from '../world/PointOfInterest'
import { MISSION_POI }     from './WaypointHUD'
import type { SideQuestSystem } from '../missions/SideQuestSystem'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZE        = 760          // canvas px (square)
const WORLD_HALF  = 1650         // metres — shows ±1650 in both axes
const SCALE       = SIZE / (WORLD_HALF * 2)   // px per metre ≈ 0.23

const POI_COLORS: Record<string, string> = {
  military_base:    '#ef5350',
  abandoned_village:'#ffa726',
  bunker:           '#ce93d8',
  outpost:          '#4fc3f7',
  crash_site:       '#90a4ae',
  checkpoint:       '#66bb6a',
}

// ── FullscreenMap ─────────────────────────────────────────────────────────────

export class FullscreenMap {
  private overlay:  HTMLElement
  private canvas:   HTMLCanvasElement
  private ctx:      CanvasRenderingContext2D
  private _open     = false
  private pulse     = 0

  // Live data set each frame by main.ts
  private playerPos:     THREE.Vector3     = new THREE.Vector3()
  private playerYaw      = 0
  private enemyPositions: THREE.Vector3[]  = []
  private sqSystem:      SideQuestSystem | null = null

  constructor() {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fmap-in { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
      .fmap-overlay {
        position:fixed; inset:0; display:none;
        background:rgba(0,0,0,0.88); backdrop-filter:blur(6px);
        align-items:center; justify-content:center; flex-direction:column;
        z-index:88; font-family:monospace;
      }
      .fmap-wrap { position:relative; animation:fmap-in 0.18s ease-out; }
      .fmap-title {
        position:absolute; top:-28px; left:50%; transform:translateX(-50%);
        color:rgba(0,220,80,0.55); font-size:10px; letter-spacing:.3em;
        white-space:nowrap; text-transform:uppercase; pointer-events:none;
      }
      .fmap-close {
        position:absolute; bottom:-26px; right:0;
        color:rgba(255,255,255,0.25); font-size:9px; letter-spacing:.15em;
        pointer-events:none;
      }
    `
    document.head.appendChild(style)

    this.overlay = document.createElement('div')
    this.overlay.className = 'fmap-overlay'
    document.body.appendChild(this.overlay)

    const wrap = document.createElement('div')
    wrap.className = 'fmap-wrap'
    this.overlay.appendChild(wrap)

    const title = document.createElement('div')
    title.className = 'fmap-title'
    title.textContent = '— TACTICAL MAP —'
    wrap.appendChild(title)

    const closeHint = document.createElement('div')
    closeHint.className = 'fmap-close'
    closeHint.textContent = '[ M ] or [ ESC ] to close'
    wrap.appendChild(closeHint)

    this.canvas = document.createElement('canvas')
    this.canvas.width  = SIZE
    this.canvas.height = SIZE
    Object.assign(this.canvas.style, {
      display: 'block',
      border:  '1px solid rgba(0,200,60,0.22)',
    })
    wrap.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')!

    // Keyboard toggle
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM')     this._open ? this.hide() : this.show()
      if (e.code === 'Escape' && this._open) this.hide()
    })

    // Click backdrop to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide()
    })
  }

  isOpen(): boolean { return this._open }

  setSQSystem(sq: SideQuestSystem): void { this.sqSystem = sq }

  show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    this.render()
  }

  hide(): void {
    this._open = false
    this.overlay.style.display = 'none'
  }

  /** Called every frame from fixedUpdate — updates data and redraws if open. */
  update(
    dt:             number,
    playerPos:      THREE.Vector3,
    playerYaw:      number,
    enemyPositions: THREE.Vector3[],
  ): void {
    this.playerPos      = playerPos
    this.playerYaw      = playerYaw
    this.enemyPositions = enemyPositions
    this.pulse         += dt * 2.2
    if (this._open) this.render()
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private w2c(wx: number, wz: number): [number, number] {
    return [
      (wx + WORLD_HALF) * SCALE,
      (wz + WORLD_HALF) * SCALE,
    ]
  }

  private render(): void {
    const ctx = this.ctx
    const S   = SIZE

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#030a04'
    ctx.fillRect(0, 0, S, S)

    // ── Terrain-style gradient strips (very subtle) ──────────────────────
    const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S * 0.7)
    grad.addColorStop(0,   'rgba(0,40,0,0.18)')
    grad.addColorStop(0.5, 'rgba(0,20,0,0.08)')
    grad.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, S, S)

    // ── Grid lines (every 200 m) ─────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0,200,0,0.07)'
    ctx.lineWidth   = 1
    for (let w = -1600; w <= 1600; w += 200) {
      const [gx] = this.w2c(w, 0)
      const [, gy] = this.w2c(0, w)
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, S); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(S, gy); ctx.stroke()
    }

    // Axes (slightly brighter)
    ctx.strokeStyle = 'rgba(0,200,0,0.16)'
    ctx.lineWidth = 1
    const [ox, oy] = this.w2c(0, 0)
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(S, oy); ctx.stroke()

    // ── Compass labels ───────────────────────────────────────────────────
    ctx.font      = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(0,220,80,0.35)'
    ctx.fillText('N', ox, 14)
    ctx.fillText('S', ox, S - 4)
    ctx.textAlign = 'left'
    ctx.fillText('W', 5, oy + 4)
    ctx.textAlign = 'right'
    ctx.fillText('E', S - 3, oy + 4)

    // ── Scale bar (bottom-left) ──────────────────────────────────────────
    const barPx = 400 * SCALE   // 400 m
    ctx.strokeStyle = 'rgba(0,220,80,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(18, S - 22); ctx.lineTo(18, S - 18)
    ctx.lineTo(18 + barPx, S - 18)
    ctx.lineTo(18 + barPx, S - 22)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,200,60,0.55)'
    ctx.font       = '8px monospace'
    ctx.textAlign  = 'left'
    ctx.fillText('400 m', 20, S - 8)

    // ── POI influence circles ────────────────────────────────────────────
    for (const poi of POI_DEFINITIONS) {
      const [px, py] = this.w2c(poi.x, poi.z)
      const r = poi.radius * SCALE
      ctx.strokeStyle = (POI_COLORS[poi.type] ?? '#888') + '18'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
    }

    // ── POI markers + labels ─────────────────────────────────────────────
    for (const poi of POI_DEFINITIONS) {
      const [px, py] = this.w2c(poi.x, poi.z)
      const col      = POI_COLORS[poi.type] ?? '#888888'

      // Icon square
      ctx.fillStyle = col + 'cc'
      ctx.fillRect(px - 3, py - 3, 6, 6)

      // Name
      ctx.fillStyle  = col + '88'
      ctx.font       = '7px monospace'
      ctx.textAlign  = 'center'
      ctx.fillText(poi.name, px, py - 6)
    }

    // ── Mission POI markers (pulsing yellow ring) ────────────────────────
    const p = 0.5 + 0.5 * Math.sin(this.pulse)
    for (const pos of Object.values(MISSION_POI)) {
      const [mx, my] = this.w2c(pos.x, pos.z)
      ctx.strokeStyle = `rgba(255,220,0,${0.55 + p * 0.45})`
      ctx.lineWidth   = 1.5
      ctx.beginPath(); ctx.arc(mx, my, 7 + p * 4, 0, Math.PI * 2); ctx.stroke()
      // Inner cross
      ctx.strokeStyle = `rgba(255,220,0,${0.3 + p * 0.3})`
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(mx - 5, my); ctx.lineTo(mx + 5, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx, my + 5); ctx.stroke()
    }

    // ── Side quest chest markers (gold diamond) ──────────────────────────
    if (this.sqSystem) {
      for (const q of this.sqSystem.quests) {
        const [cx2, cy2] = this.w2c(q.chestPos.x, q.chestPos.z)
        const done = q.status === 'complete'
        ctx.fillStyle = done ? 'rgba(100,200,100,0.5)' : 'rgba(255,180,0,0.75)'
        ctx.save()
        ctx.translate(cx2, cy2)
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(-4, -4, 8, 8)
        ctx.restore()
        ctx.fillStyle = done ? 'rgba(100,200,100,0.45)' : 'rgba(255,180,0,0.5)'
        ctx.font = '6px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(q.title, cx2, cy2 - 8)
      }
    }

    // ── Enemy positions (red dots) ───────────────────────────────────────
    for (const ep of this.enemyPositions) {
      const [ex, ey] = this.w2c(ep.x, ep.z)
      if (ex < 0 || ex > S || ey < 0 || ey > S) continue
      ctx.fillStyle = 'rgba(255,55,55,0.72)'
      ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill()
    }

    // ── Player — white arrow ─────────────────────────────────────────────
    const [ppx, ppy] = this.w2c(this.playerPos.x, this.playerPos.z)
    ctx.save()
    ctx.translate(ppx, ppy)
    ctx.rotate(this.playerYaw)   // yaw=0 → looking north (up on map)
    // Arrow body
    ctx.fillStyle   = '#ffffff'
    ctx.strokeStyle = 'rgba(0,255,80,0.8)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(0, -9)      // tip (north)
    ctx.lineTo(-5,  6)     // left base
    ctx.lineTo( 0,  3)     // tail notch
    ctx.lineTo( 5,  6)     // right base
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Bright centre dot
    ctx.fillStyle = '#00ff88'
    ctx.beginPath(); ctx.arc(ppx, ppy, 3, 0, Math.PI * 2); ctx.fill()

    // ── Legend (top-right) ───────────────────────────────────────────────
    const legendItems: [string, string][] = [
      ['#ef5350', 'Military Base'],
      ['#ffa726', 'Village / Ruins'],
      ['#ce93d8', 'Bunker'],
      ['#4fc3f7', 'Outpost'],
      ['#90a4ae', 'Crash Site'],
      ['#66bb6a', 'Safe House'],
      ['rgba(255,220,0,0.9)', 'Mission POI'],
      ['rgba(255,180,0,0.8)', 'Side Quest'],
      ['rgba(255,55,55,0.8)', 'Enemy'],
      ['#ffffff',             'You'],
    ]
    let ly = 18
    ctx.font = '8px monospace'
    for (const [col, label] of legendItems) {
      ctx.fillStyle = col
      ctx.fillRect(S - 100, ly, 8, 8)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'left'
      ctx.fillText(label, S - 88, ly + 7)
      ly += 14
    }
    // Legend box
    ctx.strokeStyle = 'rgba(0,200,60,0.15)'
    ctx.lineWidth   = 1
    ctx.strokeRect(S - 108, 8, 108, legendItems.length * 14 + 8)

    // ── Coord readout (player position) ─────────────────────────────────
    ctx.fillStyle  = 'rgba(0,200,60,0.4)'
    ctx.font       = '8px monospace'
    ctx.textAlign  = 'left'
    ctx.fillText(
      `${Math.round(this.playerPos.x)}, ${Math.round(this.playerPos.z)}`,
      18, S - 28,
    )
  }
}
