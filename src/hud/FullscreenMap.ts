import * as THREE from 'three'
import { POI_DEFINITIONS } from '../world/PointOfInterest'
import { MISSION_POI }     from './WaypointHUD'
import type { SideQuestSystem } from '../missions/SideQuestSystem'

// ── POI colours + icons ────────────────────────────────────────────────────────

const POI_COLORS: Record<string, string> = {
  military_base:    '#ef5350',
  abandoned_village:'#ffa726',
  bunker:           '#ce93d8',
  outpost:          '#4fc3f7',
  crash_site:       '#90a4ae',
  checkpoint:       '#66bb6a',
  weapon_cache:     '#ffeb3b',
  comm_tower:       '#26c6da',
  airfield:         '#ef9a9a',
  lab:              '#80cbc4',
}

const POI_ICONS: Record<string, string> = {
  military_base:    '⚑',
  abandoned_village:'⌂',
  bunker:           '⬡',
  outpost:          '▲',
  crash_site:       '✕',
  checkpoint:       '◉',
  weapon_cache:     '⊞',
  comm_tower:       '◈',
  airfield:         '✈',
  lab:              '⚗',
}

// ── 3D POI model builder ──────────────────────────────────────────────────────

function buildPOIMesh(type: string): THREE.Group {
  const g = new THREE.Group()

  const con  = new THREE.MeshStandardMaterial({ color: 0x5c6b7a, roughness: 0.7, metalness: 0.2 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x222830, roughness: 0.6, metalness: 0.4 })
  const red  = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5, emissive: new THREE.Color(0x880000), emissiveIntensity: 0.5 })
  const glow = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.3, emissive: new THREE.Color(0xff4400), emissiveIntensity: 1.5 })
  const sand = new THREE.MeshStandardMaterial({ color: 0x8b7a50, roughness: 0.9 })
  const grn  = new THREE.MeshStandardMaterial({ color: 0x3a5022, roughness: 0.8 })

  switch (type) {
    case 'military_base': {
      // Main building
      const main = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), con)
      main.position.y = 0.45; g.add(main)
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.1), dark)
      roof.position.y = 0.95; g.add(roof)
      // Guard tower
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), dark)
      tower.position.set(0.9, 0.7, 0.6); g.add(tower)
      const topBlock = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.55), con)
      topBlock.position.set(0.9, 1.52, 0.6); g.add(topBlock)
      // Flag pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), dark)
      pole.position.set(-0.5, 1.05, 0.4); g.add(pole)
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.02), red)
      flag.position.set(-0.34, 1.56, 0.4); g.add(flag)
      // Perimeter wall
      for (const [x, z, w, d] of [[-0.9, 0, 0.1, 1.4], [0.9, 0, 0.1, 1.4], [0, -0.65, 1.9, 0.1], [0, 0.65, 1.9, 0.1]] as [number,number,number,number][]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), sand)
        wall.position.set(x, 0.2, z); g.add(wall)
      }
      // Point light — red
      const light = new THREE.PointLight(0xff2222, 1.2, 6)
      light.position.set(0, 2, 0); g.add(light)
      break
    }
    case 'bunker': {
      // Main bunker body (low profile)
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 1.2), con)
      body.position.y = 0.275; g.add(body)
      // Earth berm
      const berm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 1.6), sand)
      berm.position.y = 0.22; g.add(berm)
      // Hatch
      const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8), dark)
      hatch.position.set(0, 0.6, 0); g.add(hatch)
      const hatchLid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 8), con)
      hatchLid.position.set(0.1, 0.72, 0); hatchLid.rotation.z = 0.5; g.add(hatchLid)
      // Ventilation pipes
      for (const pos of [[-0.55, -0.3], [0.55, -0.3]] as [number, number][]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), dark)
        pipe.position.set(pos[0], 0.75, pos[1]); g.add(pipe)
      }
      // Firing slits (glowing)
      for (const xoff of [-0.5, 0, 0.5]) {
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.02), glow)
        slit.position.set(xoff, 0.42, 0.62); g.add(slit)
      }
      const light = new THREE.PointLight(0xff6600, 0.8, 5)
      light.position.set(0, 0.5, 0.7); g.add(light)
      break
    }
    case 'outpost': {
      // Tower base
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), dark)
      base.position.y = 0.2; g.add(base)
      // Tower legs
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as [number, number][]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), dark)
        leg.position.set(x, 0.8, z); leg.rotation.z = (x > 0 ? 1 : -1) * 0.08; g.add(leg)
      }
      // Platform
      const platform = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.0), con)
      platform.position.y = 1.65; g.add(platform)
      // Watchtower cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), grn)
      cabin.position.y = 1.95; g.add(cabin)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.4, 4), dark)
      roof.position.y = 2.42; roof.rotation.y = Math.PI/4; g.add(roof)
      // Spotlight
      const spot = new THREE.PointLight(0xffffff, 1.5, 8)
      spot.position.set(0, 2.6, 0); g.add(spot)
      break
    }
    case 'abandoned_village': {
      // Three small ruined houses
      const houses: [number, number, number, number][] = [
        [-0.7, 0, 0.7, 0.7], [0.5, 0, 0.65, 0.75], [0, 0, 0.55, 0.6],
      ]
      houses.forEach(([x, _y, w, d], i) => {
        const wallMat = i === 0
          ? new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.9 })
          : new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.9 })
        const h = 0.5 + i * 0.1
        const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
        house.position.set(x, h / 2, 0); g.add(house)
        // Broken/partial roof on first house
        if (i !== 1) {
          const roofMesh = new THREE.Mesh(new THREE.CylinderGeometry(0, w * 0.65, 0.35, 4), dark)
          roofMesh.position.set(x, h + 0.17, 0); roofMesh.rotation.y = Math.PI/4; g.add(roofMesh)
        }
      })
      // Rubble
      for (let i = 0; i < 5; i++) {
        const rx = (Math.random() - 0.5) * 2.0
        const rz = (Math.random() - 0.5) * 1.6
        const rb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.15), sand)
        rb.position.set(rx, 0.06, rz); rb.rotation.y = Math.random() * Math.PI; g.add(rb)
      }
      const light = new THREE.PointLight(0xffa040, 0.6, 6)
      light.position.set(0, 1.2, 0); g.add(light)
      break
    }
    case 'crash_site': {
      // Fuselage (tilted)
      const fusMat = new THREE.MeshStandardMaterial({ color: 0x4a5a6a, roughness: 0.5, metalness: 0.6 })
      const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 1.6, 8), fusMat)
      fus.rotation.z = 0.7; fus.position.set(-0.2, 0.3, 0); fus.castShadow = true; g.add(fus)
      // Wing stub
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.35), fusMat)
      wing.position.set(-0.2, 0.35, 0.1); wing.rotation.z = 0.7; g.add(wing)
      // Rotor (bent)
      const rot = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), dark)
      rot.position.set(0.4, 0.8, 0); rot.rotation.z = 0.3; g.add(rot)
      // Smoke / fire
      const fireMat = new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: new THREE.Color(0xff3300), emissiveIntensity: 2.5, transparent: true, opacity: 0.7 })
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 6), fireMat)
      fire.position.set(-0.5, 0.65, 0.1); g.add(fire)
      // Debris
      for (let i = 0; i < 6; i++) {
        const db = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.14), fusMat)
        db.position.set((Math.random()-0.5)*2.2, 0.03, (Math.random()-0.5)*1.6)
        db.rotation.y = Math.random() * Math.PI; g.add(db)
      }
      const light = new THREE.PointLight(0xff4400, 2.0, 8)
      light.position.set(-0.4, 0.8, 0.1); g.add(light)
      break
    }
    case 'checkpoint': {
      // Gate posts
      for (const xoff of [-1.0, 1.0]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), con)
        post.position.set(xoff, 0.8, 0); g.add(post)
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 6), glow)
        cap.position.set(xoff, 1.7, 0); g.add(cap)
      }
      // Barrier arm
      const armMat = new THREE.MeshStandardMaterial({ color: 0xee4422, roughness: 0.5 })
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.08), armMat)
      arm.position.set(0, 1.35, 0); g.add(arm)
      // Stripe decoration
      for (let i = 0; i < 5; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.09),
          i % 2 === 0 ? armMat : new THREE.MeshStandardMaterial({ color: 0xffffff }))
        stripe.position.set(-0.85 + i * 0.42, 1.35, 0); g.add(stripe)
      }
      // Sandbag walls
      for (const side of [-1, 1]) {
        const sb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.4, 0.6), sand)
        sb.position.set(side * 1.3, 0.2, 0.5); g.add(sb)
      }
      const light = new THREE.PointLight(0xffaa00, 1.0, 6)
      light.position.set(0, 2, 0); g.add(light)
      break
    }
    default: {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), con)
      cube.position.y = 0.5; g.add(cube)
    }
  }

  return g
}

// ── FullscreenMap ─────────────────────────────────────────────────────────────

export class FullscreenMap {
  private overlay:   HTMLElement
  private canvas:    HTMLCanvasElement
  private ctx:       CanvasRenderingContext2D
  private _open      = false
  private pulse      = 0
  private mapSize:   number
  private worldHalf  = 1650
  private scale:     number

  // Hover / selection state
  private hoveredPOI: typeof POI_DEFINITIONS[number] | null = null

  // Live data
  private playerPos:      THREE.Vector3    = new THREE.Vector3()
  private playerYaw       = 0
  private enemyPositions: THREE.Vector3[]  = []
  private sqSystem:       SideQuestSystem | null = null

  // 3D POI preview renderer
  private poiRenderer:  THREE.WebGLRenderer | null = null
  private poiScene:     THREE.Scene | null = null
  private poiCamera:    THREE.PerspectiveCamera | null = null
  private poiMesh:      THREE.Group | null = null
  private poiCanvas:    HTMLCanvasElement | null = null
  private poiAnimId     = 0
  private poiNameEl:    HTMLElement | null = null
  private poiTypeEl:    HTMLElement | null = null
  private poiDistEl:    HTMLElement | null = null

  constructor() {
    // Compute layout — MAP_SIZE leaves room for a 260px right panel
    const sidePanel = 260
    this.mapSize  = Math.min(720, window.innerWidth - sidePanel - 60, window.innerHeight - 80)
    this.scale    = this.mapSize / (this.worldHalf * 2)

    // ── CSS ────────────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fmap-in { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
      .fmap-overlay {
        position:fixed; inset:0; display:none;
        background:rgba(0,0,0,0.90); backdrop-filter:blur(8px);
        align-items:center; justify-content:center; flex-direction:column;
        z-index:88; font-family:monospace;
      }
      .fmap-title {
        color:rgba(0,220,80,0.5); font-size:10px; letter-spacing:.35em;
        text-transform:uppercase; margin-bottom:10px; pointer-events:none;
      }
      .fmap-body {
        display:flex; flex-direction:row; gap:0;
        border:1px solid rgba(0,200,60,0.18);
        border-radius:4px; overflow:hidden;
        animation:fmap-in 0.18s ease-out;
      }
      .fmap-canvas-wrap { position:relative; }
      .fmap-right {
        width:260px; flex-shrink:0;
        background:rgba(0,8,2,0.92);
        border-left:1px solid rgba(0,180,60,0.14);
        display:flex; flex-direction:column;
        padding:18px 16px; gap:14px; overflow-y:auto;
      }
      .fmap-poi-section-title {
        font-size:8px; letter-spacing:.3em; color:rgba(0,200,80,0.45);
        text-transform:uppercase; padding-bottom:6px;
        border-bottom:1px solid rgba(0,180,60,0.15);
        margin-bottom:4px;
      }
      .fmap-poi-canvas {
        display:block; border-radius:3px;
        border:1px solid rgba(0,180,60,0.12);
        background:#020802;
        width:228px; height:140px;
      }
      .fmap-poi-name {
        font-size:13px; font-weight:bold; color:#c8eab8;
        letter-spacing:.06em; margin-top:4px;
      }
      .fmap-poi-type {
        font-size:9px; letter-spacing:.18em; text-transform:uppercase;
        color:rgba(160,210,130,0.5); margin-top:2px;
      }
      .fmap-poi-dist {
        font-size:9px; color:rgba(0,220,80,0.55); margin-top:2px;
      }
      .fmap-poi-empty {
        font-size:9px; color:rgba(0,180,60,0.28); letter-spacing:.1em;
        text-align:center; padding:40px 0;
      }
      .fmap-legend { display:flex; flex-direction:column; gap:4px; }
      .fmap-leg-row {
        display:flex; align-items:center; gap:6px;
        font-size:8px; color:rgba(200,220,180,0.5);
      }
      .fmap-leg-dot {
        width:8px; height:8px; border-radius:2px; flex-shrink:0;
      }
      .fmap-close {
        color:rgba(0,200,60,0.28); font-size:8px; letter-spacing:.18em;
        margin-top:8px; pointer-events:none; text-align:center;
      }
    `
    document.head.appendChild(style)

    // ── Overlay ───────────────────────────────────────────────────────────
    this.overlay = document.createElement('div')
    this.overlay.className = 'fmap-overlay'
    document.body.appendChild(this.overlay)

    const titleEl = document.createElement('div')
    titleEl.className = 'fmap-title'
    titleEl.textContent = '◈  TACTICAL MAP  ◈'
    this.overlay.appendChild(titleEl)

    const body = document.createElement('div')
    body.className = 'fmap-body'
    this.overlay.appendChild(body)

    // ── Map canvas ────────────────────────────────────────────────────────
    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'fmap-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.width  = this.mapSize
    this.canvas.height = this.mapSize
    // Explicit CSS size to prevent stretching
    this.canvas.style.display = 'block'
    this.canvas.style.width   = this.mapSize + 'px'
    this.canvas.style.height  = this.mapSize + 'px'
    this.canvas.style.cursor  = 'crosshair'
    canvasWrap.appendChild(this.canvas)
    body.appendChild(canvasWrap)

    this.ctx = this.canvas.getContext('2d')!

    // Mouse hover → update POI preview
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const mx   = (e.clientX - rect.left) * (this.mapSize / rect.width)
      const my   = (e.clientY - rect.top)  * (this.mapSize / rect.height)
      let found: typeof POI_DEFINITIONS[number] | null = null
      for (const poi of POI_DEFINITIONS) {
        const [px, py] = this.w2c(poi.x, poi.z)
        if (Math.hypot(mx - px, my - py) < 14) { found = poi; break }
      }
      if (found !== this.hoveredPOI) {
        this.hoveredPOI = found
        if (found) this.loadPOIPreview(found)
        else       this.clearPOIPreview()
      }
    })
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredPOI = null
      this.clearPOIPreview()
    })

    // ── Right panel ───────────────────────────────────────────────────────
    const rightPanel = document.createElement('div')
    rightPanel.className = 'fmap-right'
    body.appendChild(rightPanel)

    // POI 3D preview section
    const previewTitle = document.createElement('div')
    previewTitle.className = 'fmap-poi-section-title'
    previewTitle.textContent = 'Location Preview'
    rightPanel.appendChild(previewTitle)

    // Three.js preview canvas
    this.poiCanvas = document.createElement('canvas')
    this.poiCanvas.className = 'fmap-poi-canvas'
    this.poiCanvas.width  = 456   // 2× for DPR sharpness, CSS = 228
    this.poiCanvas.height = 280
    rightPanel.appendChild(this.poiCanvas)

    this.poiNameEl = document.createElement('div')
    this.poiNameEl.className = 'fmap-poi-name'

    this.poiTypeEl = document.createElement('div')
    this.poiTypeEl.className = 'fmap-poi-type'

    this.poiDistEl = document.createElement('div')
    this.poiDistEl.className = 'fmap-poi-dist'

    const emptyHint = document.createElement('div')
    emptyHint.className = 'fmap-poi-empty'
    emptyHint.textContent = 'Hover a marker\nto preview'

    rightPanel.appendChild(this.poiNameEl)
    rightPanel.appendChild(this.poiTypeEl)
    rightPanel.appendChild(this.poiDistEl)
    rightPanel.appendChild(emptyHint)
    this.poiNameEl.style.display = 'none'
    this.poiTypeEl.style.display = 'none'
    this.poiDistEl.style.display = 'none'

    // Store emptyHint ref
    ;(this as unknown as Record<string, unknown>)['_emptyHint'] = emptyHint

    // Legend section
    const legTitle = document.createElement('div')
    legTitle.className = 'fmap-poi-section-title'
    legTitle.textContent = 'Map Legend'
    rightPanel.appendChild(legTitle)

    const legItems: [string, string][] = [
      ['#ef5350', 'Military Base'],
      ['#ffa726', 'Village / Ruins'],
      ['#ce93d8', 'Bunker'],
      ['#4fc3f7', 'Outpost'],
      ['#90a4ae', 'Crash Site'],
      ['#66bb6a', 'Checkpoint'],
      ['rgba(255,220,0,0.9)', 'Mission Target'],
      ['rgba(255,180,0,0.8)', 'Side Quest'],
      ['rgba(255,55,55,0.8)', 'Enemy'],
      ['#ffffff',             'You'],
    ]
    const leg = document.createElement('div')
    leg.className = 'fmap-legend'
    for (const [col, label] of legItems) {
      const row = document.createElement('div')
      row.className = 'fmap-leg-row'
      const dot = document.createElement('div')
      dot.className = 'fmap-leg-dot'
      dot.style.background = col
      const txt = document.createElement('span')
      txt.textContent = label
      row.appendChild(dot); row.appendChild(txt)
      leg.appendChild(row)
    }
    rightPanel.appendChild(leg)

    // Close hint
    const closeHint = document.createElement('div')
    closeHint.className = 'fmap-close'
    closeHint.textContent = '[ M ]  or  [ ESC ]  to close'
    this.overlay.appendChild(closeHint)

    // ── Init Three.js POI renderer ────────────────────────────────────────
    this.initPOIRenderer()

    // ── Keyboard ──────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM')                 this._open ? this.hide() : this.show()
      if (e.code === 'Escape' && this._open) this.hide()
    })
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide()
    })
  }

  // ── POI 3D renderer ───────────────────────────────────────────────────────

  private initPOIRenderer(): void {
    if (!this.poiCanvas) return
    try {
      this.poiRenderer = new THREE.WebGLRenderer({
        canvas: this.poiCanvas, antialias: true, alpha: true,
      })
      this.poiRenderer.setSize(456, 280)
      this.poiRenderer.setClearColor(0x010904, 1)

      this.poiScene = new THREE.Scene()

      const amb = new THREE.AmbientLight(0x88aacc, 0.7)
      this.poiScene.add(amb)
      const key = new THREE.DirectionalLight(0xfff8e8, 1.8)
      key.position.set(3, 5, 3); this.poiScene.add(key)
      const fill = new THREE.DirectionalLight(0x3366aa, 0.4)
      fill.position.set(-3, 1, -2); this.poiScene.add(fill)
      const rim = new THREE.DirectionalLight(0x002244, 0.3)
      rim.position.set(0, -2, -3); this.poiScene.add(rim)

      this.poiCamera = new THREE.PerspectiveCamera(42, 456 / 280, 0.05, 40)
      this.poiCamera.position.set(3.2, 2.8, 3.8)
      this.poiCamera.lookAt(0, 0.6, 0)

      this.poiMesh = new THREE.Group()
      this.poiScene.add(this.poiMesh)

      // Ground plane
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2415, roughness: 0.95 })
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), groundMat)
      ground.rotation.x = -Math.PI / 2; this.poiScene.add(ground)

      // Subtle grid lines on ground
      const gridHelper = new THREE.GridHelper(8, 8, 0x1e3018, 0x1e3018)
      this.poiScene.add(gridHelper)

      // Fog
      this.poiScene.fog = new THREE.Fog(0x010904, 6, 18)
    } catch {
      // WebGL not available — graceful degradation
      this.poiRenderer = null
    }
  }

  private loadPOIPreview(poi: typeof POI_DEFINITIONS[number]): void {
    if (!this.poiMesh || !this.poiRenderer || !this.poiScene || !this.poiCamera) return

    // Clear old mesh
    while (this.poiMesh.children.length > 0) {
      const child = this.poiMesh.children[0]
      if (!child) break
      this.poiMesh.remove(child)
      if (child instanceof THREE.Mesh) { child.geometry.dispose() }
    }

    // Load new mesh
    const mesh = buildPOIMesh(poi.type)
    this.poiMesh.add(mesh)
    this.poiMesh.rotation.y = 0

    // Update labels
    if (this.poiNameEl) { this.poiNameEl.textContent = poi.name; this.poiNameEl.style.display = '' }
    if (this.poiTypeEl) {
      const col = POI_COLORS[poi.type] ?? '#888'
      this.poiTypeEl.textContent = poi.type.replace(/_/g, ' ')
      this.poiTypeEl.style.color = col + 'cc'
      this.poiTypeEl.style.display = ''
    }
    if (this.poiDistEl) {
      const dist = Math.round(this.playerPos.distanceTo(new THREE.Vector3(poi.x, 0, poi.z)))
      this.poiDistEl.textContent = `${dist} m away`
      this.poiDistEl.style.display = ''
    }

    const empty = (this as unknown as Record<string, unknown>)['_emptyHint'] as HTMLElement | undefined
    if (empty) empty.style.display = 'none'
  }

  private clearPOIPreview(): void {
    if (this.poiNameEl) this.poiNameEl.style.display = 'none'
    if (this.poiTypeEl) this.poiTypeEl.style.display = 'none'
    if (this.poiDistEl) this.poiDistEl.style.display = 'none'
    const empty = (this as unknown as Record<string, unknown>)['_emptyHint'] as HTMLElement | undefined
    if (empty) empty.style.display = ''

    if (this.poiMesh) {
      while (this.poiMesh.children.length > 0) {
        const c = this.poiMesh.children[0]
        if (!c) break
        this.poiMesh.remove(c)
      }
    }
  }

  private animatePOI = (): void => {
    if (!this._open || !this.poiRenderer || !this.poiScene || !this.poiCamera) return
    this.poiAnimId = requestAnimationFrame(this.animatePOI)
    if (this.poiMesh) this.poiMesh.rotation.y += 0.006
    this.poiRenderer.render(this.poiScene, this.poiCamera)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  isOpen(): boolean { return this._open }
  setSQSystem(sq: SideQuestSystem): void { this.sqSystem = sq }

  show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    this.render()
    this.animatePOI()
  }

  hide(): void {
    this._open = false
    this.overlay.style.display = 'none'
    cancelAnimationFrame(this.poiAnimId)
  }

  update(dt: number, playerPos: THREE.Vector3, playerYaw: number, enemyPositions: THREE.Vector3[]): void {
    this.playerPos      = playerPos
    this.playerYaw      = playerYaw
    this.enemyPositions = enemyPositions
    this.pulse         += dt * 2.2
    if (this._open) this.render()
  }

  // ── Coordinate helpers ────────────────────────────────────────────────────

  private w2c(wx: number, wz: number): [number, number] {
    return [
      (wx + this.worldHalf) * this.scale,
      (wz + this.worldHalf) * this.scale,
    ]
  }

  // ── 2D Map Render ─────────────────────────────────────────────────────────

  private render(): void {
    const ctx = this.ctx
    const S   = this.mapSize

    // Background
    ctx.fillStyle = '#030a04'
    ctx.fillRect(0, 0, S, S)

    // Radial gradient overlay
    const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S * 0.7)
    grad.addColorStop(0,   'rgba(0,40,0,0.18)')
    grad.addColorStop(0.5, 'rgba(0,20,0,0.08)')
    grad.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S)

    // Grid lines (every 200 m)
    ctx.strokeStyle = 'rgba(0,200,0,0.06)'
    ctx.lineWidth   = 1
    for (let w = -1600; w <= 1600; w += 200) {
      const [gx] = this.w2c(w, 0); const [, gy] = this.w2c(0, w)
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, S); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(S, gy); ctx.stroke()
    }
    // Axes
    ctx.strokeStyle = 'rgba(0,200,0,0.14)'; ctx.lineWidth = 1
    const [ox, oy] = this.w2c(0, 0)
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(S, oy); ctx.stroke()

    // Compass labels
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(0,220,80,0.32)'
    ctx.textAlign = 'center';  ctx.fillText('N', ox, 14)
    ctx.fillText('S', ox, S - 4)
    ctx.textAlign = 'left';    ctx.fillText('W', 5, oy + 4)
    ctx.textAlign = 'right';   ctx.fillText('E', S - 3, oy + 4)

    // Scale bar
    const barPx = 400 * this.scale
    ctx.strokeStyle = 'rgba(0,220,80,0.45)'; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(18, S - 22); ctx.lineTo(18, S - 18)
    ctx.lineTo(18 + barPx, S - 18); ctx.lineTo(18 + barPx, S - 22)
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,200,60,0.5)'; ctx.font = '8px monospace'
    ctx.textAlign = 'left'; ctx.fillText('400 m', 20, S - 8)

    // POI influence circles
    for (const poi of POI_DEFINITIONS) {
      const [px, py] = this.w2c(poi.x, poi.z)
      const r = poi.radius * this.scale
      ctx.strokeStyle = (POI_COLORS[poi.type] ?? '#888') + '14'
      ctx.lineWidth = 1; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
    }

    // POI markers — 3D-style icons
    for (const poi of POI_DEFINITIONS) {
      const [px, py] = this.w2c(poi.x, poi.z)
      const col      = POI_COLORS[poi.type] ?? '#888888'
      const icon     = POI_ICONS[poi.type] ?? '◆'
      const isHover  = this.hoveredPOI === poi

      // Outer glow ring
      if (isHover) {
        ctx.strokeStyle = col + 'aa'
        ctx.lineWidth   = 2
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.stroke()
      }

      // Shadow/ground indicator
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath(); ctx.ellipse(px + 1, py + 2, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill()

      // Icon background
      const r = isHover ? 10 : 8
      ctx.fillStyle = col + (isHover ? 'ee' : 'cc')
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke()

      // Icon
      ctx.font       = `${isHover ? 9 : 8}px monospace`
      ctx.textAlign  = 'center'
      ctx.fillStyle  = 'rgba(0,0,0,0.85)'
      ctx.fillText(icon, px, py + 3)

      // Label
      ctx.fillStyle  = col + (isHover ? 'ee' : '88')
      ctx.font       = `${isHover ? 8 : 7}px monospace`
      ctx.fillText(poi.name, px, py - (isHover ? 17 : 14))
    }

    // Mission POI markers (pulsing yellow ring)
    const p = 0.5 + 0.5 * Math.sin(this.pulse)
    for (const pos of Object.values(MISSION_POI)) {
      const [mx, my] = this.w2c(pos.x, pos.z)
      // Outer pulse
      ctx.strokeStyle = `rgba(255,220,0,${0.3 + p * 0.25})`
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.arc(mx, my, 10 + p * 5, 0, Math.PI * 2); ctx.stroke()
      // Inner marker
      ctx.fillStyle   = `rgba(255,220,0,${0.7 + p * 0.3})`
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(255,220,0,${0.5 + p * 0.3})`
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(mx - 6, my); ctx.lineTo(mx + 6, my); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my + 6); ctx.stroke()
    }

    // Side quest markers
    if (this.sqSystem) {
      for (const q of this.sqSystem.quests) {
        const [cx2, cy2] = this.w2c(q.chestPos.x, q.chestPos.z)
        const done = q.status === 'complete'
        ctx.fillStyle = done ? 'rgba(100,200,100,0.5)' : 'rgba(255,180,0,0.75)'
        ctx.save(); ctx.translate(cx2, cy2); ctx.rotate(Math.PI / 4)
        ctx.fillRect(-4, -4, 8, 8); ctx.restore()
        ctx.fillStyle = done ? 'rgba(100,200,100,0.45)' : 'rgba(255,180,0,0.5)'
        ctx.font = '6px monospace'; ctx.textAlign = 'center'
        ctx.fillText(q.title, cx2, cy2 - 8)
      }
    }

    // Enemy positions
    for (const ep of this.enemyPositions) {
      const [ex, ey] = this.w2c(ep.x, ep.z)
      if (ex < 0 || ex > S || ey < 0 || ey > S) continue
      ctx.fillStyle = 'rgba(255,55,55,0.72)'
      ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill()
    }

    // Player arrow
    const [ppx, ppy] = this.w2c(this.playerPos.x, this.playerPos.z)
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(ppx + 1, ppy + 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill()
    // Arrow
    ctx.save(); ctx.translate(ppx, ppy); ctx.rotate(this.playerYaw)
    ctx.fillStyle   = '#ffffff'
    ctx.strokeStyle = 'rgba(0,255,80,0.9)'; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -10); ctx.lineTo(-6, 7); ctx.lineTo(0, 4); ctx.lineTo(6, 7)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
    ctx.fillStyle = '#00ff88'
    ctx.beginPath(); ctx.arc(ppx, ppy, 3.5, 0, Math.PI * 2); ctx.fill()

    // Player coords
    ctx.fillStyle  = 'rgba(0,200,60,0.38)'; ctx.font = '8px monospace'
    ctx.textAlign  = 'left'
    ctx.fillText(`${Math.round(this.playerPos.x)}, ${Math.round(this.playerPos.z)}`, 18, S - 28)
  }
}
