import * as THREE               from 'three'
import type { WeaponManager }   from '../weapons/WeaponManager'
import type { WeaponBase }      from '../weapons/WeaponBase'
import type { CashSystem }      from '../economy/CashSystem'
import type { GrenadeSystem }   from '../combat/GrenadeSystem'
import type { UpgradeSystem }   from '../player/UpgradeSystem'
import { UPGRADE_DEFS }         from '../player/UpgradeSystem'
import { AttachmentRegistry }   from '../weapons/AttachmentRegistry'
import type { AttachmentDef }   from '../weapons/AttachmentRegistry'
import type { AttachmentSlot }  from '../weapons/WeaponRegistry'
import { bus }                  from '../core/EventBus'
import { ghillie }              from '../effects/GhillieSystem'

// ── 3D Weapon Mesh Builder ────────────────────────────────────────────────────

function buildWeaponMesh(category: string): THREE.Group {
  const g      = new THREE.Group()
  const dark   = new THREE.MeshStandardMaterial({ color: 0x1a1e14, roughness: 0.5, metalness: 0.7 })
  const metal  = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.25, metalness: 0.92 })
  const body   = new THREE.MeshStandardMaterial({ color: 0x2a3320, roughness: 0.75, metalness: 0.1 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 })
  const tan    = new THREE.MeshStandardMaterial({ color: 0x8c7a50, roughness: 0.8,  metalness: 0.05 })

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m
  }

  switch (category) {
    case 'rifle': {
      // Receiver (main body)
      const recv = mesh(new THREE.BoxGeometry(0.06, 0.065, 0.42), body)
      recv.position.set(0, 0, 0); g.add(recv)
      // Upper receiver / dust cover
      const upper = mesh(new THREE.BoxGeometry(0.055, 0.045, 0.30), dark)
      upper.position.set(0, 0.056, -0.04); g.add(upper)
      // Barrel
      const brl = mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.38, 8), metal)
      brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.042, -0.33); g.add(brl)
      // Muzzle device
      const muzzle = mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.06, 8), metal)
      muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.042, -0.54); g.add(muzzle)
      // Handguard
      const guard = mesh(new THREE.BoxGeometry(0.05, 0.048, 0.22), dark)
      guard.position.set(0, 0.025, -0.18); g.add(guard)
      // Stock
      const stock = mesh(new THREE.BoxGeometry(0.045, 0.062, 0.18), body)
      stock.position.set(0, -0.005, 0.24); g.add(stock)
      const buttpad = mesh(new THREE.BoxGeometry(0.042, 0.07, 0.025), rubber)
      buttpad.position.set(0, -0.005, 0.34); g.add(buttpad)
      // Magazine
      const mag = mesh(new THREE.BoxGeometry(0.032, 0.14, 0.048), dark)
      mag.position.set(0, -0.095, 0.02); g.add(mag)
      // Pistol grip
      const grip = mesh(new THREE.BoxGeometry(0.038, 0.095, 0.04), rubber)
      grip.position.set(0, -0.07, 0.12); grip.rotation.x = 0.25; g.add(grip)
      // Trigger guard
      const trig = mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8, Math.PI), metal)
      trig.position.set(0, -0.03, 0.09); trig.rotation.x = Math.PI; g.add(trig)
      // Charging handle
      const ch = mesh(new THREE.BoxGeometry(0.008, 0.015, 0.03), metal)
      ch.position.set(0, 0.032, 0.06); g.add(ch)
      // Carry handle / rail
      const rail = mesh(new THREE.BoxGeometry(0.048, 0.012, 0.26), dark)
      rail.position.set(0, 0.092, -0.04); g.add(rail)
      break
    }
    case 'sniper': {
      // Long receiver
      const recv = mesh(new THREE.BoxGeometry(0.055, 0.06, 0.52), body)
      recv.position.set(0, 0, 0); g.add(recv)
      // Very long barrel (suppressed)
      const brl = mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.62, 8), metal)
      brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.036, -0.5); g.add(brl)
      // Suppressor
      const sup = mesh(new THREE.CylinderGeometry(0.022, 0.020, 0.14, 10), metal)
      sup.rotation.x = Math.PI / 2; sup.position.set(0, 0.036, -0.85); g.add(sup)
      // Scope
      const scopeBody = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 12), dark)
      scopeBody.rotation.x = Math.PI / 2; scopeBody.position.set(0, 0.098, -0.06); g.add(scopeBody)
      const scopeFront = mesh(new THREE.CylinderGeometry(0.020, 0.026, 0.04, 12), metal)
      scopeFront.rotation.x = Math.PI / 2; scopeFront.position.set(0, 0.098, -0.19); g.add(scopeFront)
      const scopeBack = mesh(new THREE.CylinderGeometry(0.020, 0.026, 0.04, 12), metal)
      scopeBack.rotation.x = Math.PI / 2; scopeBack.position.set(0, 0.098, 0.07); g.add(scopeBack)
      // Scope lens glow
      const lens = mesh(new THREE.CircleGeometry(0.018, 12),
        new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: new THREE.Color(0x2244cc), emissiveIntensity: 1.0 }))
      lens.rotation.y = Math.PI / 2; lens.position.set(0, 0.098, -0.21); g.add(lens)
      // Cheek piece stock
      const stock = mesh(new THREE.BoxGeometry(0.048, 0.055, 0.28), tan)
      stock.position.set(0, 0.01, 0.28); g.add(stock)
      const cheek = mesh(new THREE.BoxGeometry(0.045, 0.05, 0.12), tan)
      cheek.position.set(0, 0.045, 0.28); g.add(cheek)
      // Bipod legs
      for (const sx of [-0.055, 0.055]) {
        const leg = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 4), metal)
        leg.position.set(sx, -0.1, -0.26); leg.rotation.z = sx > 0 ? 0.3 : -0.3; g.add(leg)
      }
      // Magazine (box mag)
      const mag = mesh(new THREE.BoxGeometry(0.030, 0.10, 0.040), dark)
      mag.position.set(0, -0.08, 0.04); g.add(mag)
      break
    }
    case 'smg': {
      // Compact receiver
      const recv = mesh(new THREE.BoxGeometry(0.055, 0.060, 0.32), body)
      recv.position.set(0, 0, 0); g.add(recv)
      // Short barrel
      const brl = mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.18, 8), metal)
      brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.036, -0.22); g.add(brl)
      // Muzzle brake
      const muzzle = mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.04, 6), metal)
      muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.036, -0.33); g.add(muzzle)
      // Folding stock
      const stock1 = mesh(new THREE.BoxGeometry(0.010, 0.050, 0.15), metal)
      stock1.position.set(0.025, -0.01, 0.22); g.add(stock1)
      const stock2 = mesh(new THREE.BoxGeometry(0.010, 0.050, 0.15), metal)
      stock2.position.set(-0.025, -0.01, 0.22); g.add(stock2)
      const stockCap = mesh(new THREE.BoxGeometry(0.06, 0.045, 0.015), rubber)
      stockCap.position.set(0, -0.01, 0.3); g.add(stockCap)
      // Large magazine (staggered)
      const mag = mesh(new THREE.BoxGeometry(0.028, 0.17, 0.044), dark)
      mag.position.set(0, -0.11, 0.02); g.add(mag)
      // Foregrip
      const fgrip = mesh(new THREE.BoxGeometry(0.034, 0.08, 0.034), rubber)
      fgrip.position.set(0, -0.065, -0.14); g.add(fgrip)
      break
    }
    case 'shotgun': {
      // Wide receiver
      const recv = mesh(new THREE.BoxGeometry(0.065, 0.07, 0.38), body)
      recv.position.set(0, 0, 0); g.add(recv)
      // Barrel (tube)
      const brl = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 8), metal)
      brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.048, -0.28); g.add(brl)
      // Tube magazine under barrel
      const tubeMag = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8), metal)
      tubeMag.rotation.x = Math.PI / 2; tubeMag.position.set(0, 0.018, -0.24); g.add(tubeMag)
      // Pump forend
      const pump = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.10), tan)
      pump.position.set(0, 0.024, -0.20); g.add(pump)
      // Wooden stock
      const stock = mesh(new THREE.BoxGeometry(0.05, 0.065, 0.24), tan)
      stock.position.set(0, -0.008, 0.24); g.add(stock)
      // Heat shield on barrel
      const shield = mesh(new THREE.BoxGeometry(0.048, 0.016, 0.30), dark)
      shield.position.set(0, 0.07, -0.22); g.add(shield)
      break
    }
    case 'pistol': {
      // Compact slide
      const slide = mesh(new THREE.BoxGeometry(0.038, 0.048, 0.22), metal)
      slide.position.set(0, 0.024, 0); g.add(slide)
      // Barrel
      const brl = mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.16, 8), metal)
      brl.rotation.x = Math.PI / 2; brl.position.set(0, 0.028, -0.16); g.add(brl)
      // Frame
      const frame = mesh(new THREE.BoxGeometry(0.036, 0.04, 0.18), body)
      frame.position.set(0, -0.012, 0.01); g.add(frame)
      // Grip
      const grip = mesh(new THREE.BoxGeometry(0.034, 0.10, 0.036), rubber)
      grip.position.set(0, -0.08, 0.09); g.add(grip)
      // Trigger guard
      const tg = mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8, Math.PI), dark)
      tg.position.set(0, -0.025, 0.04); tg.rotation.x = Math.PI; g.add(tg)
      // Magazine base
      const mag = mesh(new THREE.BoxGeometry(0.032, 0.08, 0.034), dark)
      mag.position.set(0, -0.085, 0.09); g.add(mag)
      // Front sight
      const sight = mesh(new THREE.BoxGeometry(0.008, 0.014, 0.006), metal)
      sight.position.set(0, 0.056, -0.11); g.add(sight)
      break
    }
    case 'explosive': {
      // Rocket tube
      const tube = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.7, 12), dark)
      tube.rotation.x = Math.PI / 2; tube.position.set(0, 0, 0); g.add(tube)
      // Rear cone (exhaust)
      const rear = mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.15, 10), metal)
      rear.rotation.x = Math.PI / 2; rear.position.set(0, 0, 0.43); g.add(rear)
      // Front cap
      const front = mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.08, 10), metal)
      front.rotation.x = Math.PI / 2; front.position.set(0, 0, -0.4); g.add(front)
      // Warhead tip
      const tip = mesh(new THREE.ConeGeometry(0.04, 0.14, 10), new THREE.MeshStandardMaterial({
        color: 0xcc2200, roughness: 0.4, metalness: 0.5,
      }))
      tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0, -0.54); g.add(tip)
      // Shoulder rest
      const shoulder = mesh(new THREE.BoxGeometry(0.05, 0.04, 0.55), rubber)
      shoulder.position.set(0, -0.065, 0); g.add(shoulder)
      // Sight
      const sight = mesh(new THREE.BoxGeometry(0.014, 0.06, 0.12), dark)
      sight.position.set(0, 0.085, 0); g.add(sight)
      // Fins
      for (let i = 0; i < 4; i++) {
        const fin = mesh(new THREE.BoxGeometry(0.08, 0.005, 0.08), metal)
        fin.rotation.x = (i / 4) * Math.PI * 2; fin.position.set(0, 0, 0.3)
        g.add(fin)
      }
      break
    }
    default: {
      // Fallback: generic box weapon
      const r = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), body); g.add(r)
      const b = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), metal)
      b.rotation.x = Math.PI / 2; b.position.set(0, 0.04, -0.29); g.add(b)
    }
  }

  return g
}

// ── Colours per category ──────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  rifle:     '#4fc3f7',
  smg:       '#81d4fa',
  sniper:    '#ce93d8',
  shotgun:   '#ffcc80',
  pistol:    '#a5d6a7',
  explosive: '#ef9a9a',
  flag:      '#ffd700',
}
const fallbackColor = '#90a4ae'

function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? fallbackColor
}

const SLOT_ORDER: AttachmentSlot[] = ['scope', 'muzzle', 'grip', 'magazine', 'underbarrel']
const SLOT_LABEL: Record<AttachmentSlot, string> = {
  scope:       'SCOPE',
  muzzle:      'MUZZLE',
  grip:        'GRIP',
  magazine:    'MAGAZINE',
  underbarrel: 'UNDERBARREL',
}

// ── WeaponLoadoutMenu ─────────────────────────────────────────────────────────

export class WeaponLoadoutMenu {
  private overlay:      HTMLElement
  private slotEls:      HTMLElement[] = []
  private bpList:       HTMLElement
  private attPanel:     HTMLElement
  private upgradePanel: HTMLElement
  private rightMode:    'attachments' | 'upgrades' = 'attachments'
  private tabAtt:       HTMLElement
  private tabUpg:       HTMLElement
  private _open         = false
  private selected:     0 | 1 | 2 | null = null

  // 3D weapon preview
  private previewRenderer: THREE.WebGLRenderer | null = null
  private previewScene:    THREE.Scene | null = null
  private previewCamera:   THREE.PerspectiveCamera | null = null
  private previewMesh:     THREE.Group | null = null
  private previewAnimId    = 0
  private previewNameEl:   HTMLElement | null = null
  private previewCatEl:    HTMLElement | null = null

  constructor(
    private mgr:      WeaponManager,
    private cash:     CashSystem,
    private grenades: GrenadeSystem,
    private upgrades: UpgradeSystem,
  ) {
    // ── Shared CSS ────────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      .att-buy-btn {
        padding:3px 10px; border-radius:2px; cursor:pointer; font-size:9px;
        font-family:monospace; letter-spacing:.12em; border:1px solid rgba(255,215,0,0.45);
        background:rgba(255,215,0,0.08); color:#ffd700; transition:background 0.12s;
        white-space:nowrap;
      }
      .att-buy-btn:hover { background:rgba(255,215,0,0.18); }
      .att-buy-btn.equipped {
        border-color:rgba(100,220,100,0.5); background:rgba(100,220,100,0.1); color:#6fef8f;
        cursor:default;
      }
      .att-buy-btn.unequip {
        border-color:rgba(255,80,80,0.4); background:rgba(255,80,80,0.08); color:#ff6060;
      }
      .att-buy-btn.unequip:hover { background:rgba(255,80,80,0.18); }
      .att-buy-btn.cant-afford { opacity:0.35; cursor:not-allowed; }
      .att-slot-header {
        font-size:8px; letter-spacing:.2em; color:rgba(255,255,255,0.28);
        text-transform:uppercase; padding:7px 0 4px; border-top:1px solid rgba(255,255,255,0.06);
        margin-top:6px;
      }
      .att-slot-header:first-child { border-top:none; margin-top:0; padding-top:0; }
      .att-row {
        display:flex; align-items:center; justify-content:space-between;
        gap:10px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04);
      }
      .att-row:last-child { border-bottom:none; }
    `
    document.head.appendChild(style)

    // ── Overlay ──────────────────────────────────────────────────────────────
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(5px)',
      fontFamily: 'monospace', color: '#fff', zIndex: '85',
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '5vh', gap: '28px', paddingLeft: '20px', paddingRight: '20px',
    })

    // ── Left column: loadout ──────────────────────────────────────────────────
    const leftCol = document.createElement('div')
    Object.assign(leftCol.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: '0', flexShrink: '0',
    })

    // Title
    const title = document.createElement('div')
    Object.assign(title.style, {
      fontSize: '11px', letterSpacing: '.22em', color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase', marginBottom: '22px',
    })
    title.textContent = 'WEAPON LOADOUT  —  Tab to close  ·  Click slot → select  ·  Click backpack → swap  ·  Right-click slot → holster'
    leftCol.appendChild(title)

    // ── 3D Weapon Preview ─────────────────────────────────────────────────────
    const previewWrap = document.createElement('div')
    Object.assign(previewWrap.style, {
      width: '100%', height: '150px',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '4px', marginBottom: '18px',
      overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
    })

    const previewCanvas = document.createElement('canvas')
    previewCanvas.width  = 1284   // retina
    previewCanvas.height = 560
    Object.assign(previewCanvas.style, {
      display: 'block', width: '100%', height: '130px', flex: '0 0 auto',
    })
    previewWrap.appendChild(previewCanvas)

    const previewInfo = document.createElement('div')
    Object.assign(previewInfo.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '4px 12px 5px', borderTop: '1px solid rgba(255,255,255,0.07)',
    })

    this.previewNameEl = document.createElement('div')
    Object.assign(this.previewNameEl.style, {
      fontSize: '11px', fontWeight: 'bold', color: '#c8e0b8', letterSpacing: '.06em',
    })
    this.previewNameEl.textContent = 'SELECT A WEAPON'

    this.previewCatEl = document.createElement('div')
    Object.assign(this.previewCatEl.style, {
      fontSize: '8px', letterSpacing: '.2em', textTransform: 'uppercase',
      color: 'rgba(180,220,140,0.4)',
    })

    previewInfo.appendChild(this.previewNameEl)
    previewInfo.appendChild(this.previewCatEl)
    previewWrap.appendChild(previewInfo)
    leftCol.appendChild(previewWrap)

    // Init Three.js preview renderer
    this.initPreviewRenderer(previewCanvas)

    // Slot row
    const slotRow = document.createElement('div')
    Object.assign(slotRow.style, { display: 'flex', gap: '14px', marginBottom: '28px' })
    for (let i = 0; i < 3; i++) {
      const el = this.makeSlotCard(i as 0 | 1 | 2)
      slotRow.appendChild(el)
      this.slotEls.push(el)
    }
    leftCol.appendChild(slotRow)

    // Backpack header
    const bpHeader = document.createElement('div')
    Object.assign(bpHeader.style, {
      fontSize: '10px', letterSpacing: '.16em', color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', marginBottom: '12px',
    })
    bpHeader.textContent = 'Backpack'
    leftCol.appendChild(bpHeader)

    const bpScroll = document.createElement('div')
    Object.assign(bpScroll.style, { overflowY: 'auto', maxHeight: '42vh', width: '642px' })
    this.bpList = document.createElement('div')
    Object.assign(this.bpList.style, { display: 'flex', flexWrap: 'wrap', gap: '12px' })
    bpScroll.appendChild(this.bpList)
    leftCol.appendChild(bpScroll)

    this.overlay.appendChild(leftCol)

    // ── Right column: attachment shop + upgrades ───────────────────────────────
    const rightCol = document.createElement('div')
    Object.assign(rightCol.style, {
      width: '330px', flexShrink: '0', display: 'flex', flexDirection: 'column', gap: '0',
    })

    // Tab bar
    const tabBar = document.createElement('div')
    Object.assign(tabBar.style, {
      display: 'flex', gap: '6px', marginBottom: '14px',
    })

    const makeTab = (label: string, mode: 'attachments' | 'upgrades'): HTMLElement => {
      const btn = document.createElement('button')
      Object.assign(btn.style, {
        flex: '1', padding: '5px 0', border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
        fontFamily: 'monospace', fontSize: '9px', letterSpacing: '.18em',
        textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
      })
      btn.textContent = label
      btn.addEventListener('click', () => {
        this.rightMode = mode
        this.updateTabs()
        this.rebuildAttachPanel()
        this.rebuildUpgradePanel()
      })
      return btn
    }

    this.tabAtt = makeTab('ATTACHMENTS', 'attachments')
    this.tabUpg = makeTab('UPGRADES',    'upgrades')
    tabBar.appendChild(this.tabAtt)
    tabBar.appendChild(this.tabUpg)
    rightCol.appendChild(tabBar)

    // Attachment panel
    const attScroll = document.createElement('div')
    Object.assign(attScroll.style, { overflowY: 'auto', maxHeight: '85vh' })
    this.attPanel = document.createElement('div')
    Object.assign(this.attPanel.style, { display: 'flex', flexDirection: 'column' })
    attScroll.appendChild(this.attPanel)
    rightCol.appendChild(attScroll)

    // Upgrade panel (hidden by default)
    const upgScroll = document.createElement('div')
    Object.assign(upgScroll.style, { overflowY: 'auto', maxHeight: '85vh', display: 'none' })
    this.upgradePanel = document.createElement('div')
    Object.assign(this.upgradePanel.style, { display: 'flex', flexDirection: 'column', gap: '0' })
    upgScroll.appendChild(this.upgradePanel)
    rightCol.appendChild(upgScroll)

    // Store scroll refs for tab toggling
    ;(this.tabAtt as unknown as Record<string, unknown>)['_scroll'] = attScroll
    ;(this.tabUpg as unknown as Record<string, unknown>)['_scroll'] = upgScroll

    this.overlay.appendChild(rightCol)
    document.body.appendChild(this.overlay)

    // ── Keyboard toggle ───────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        this._open ? this.hide() : this.show()
      }
    })

    bus.on('loadoutChanged', () => { if (this._open) this.rebuild() })
    bus.on<number>('cashChanged', () => {
      if (!this._open) return
      this.rebuildAttachPanel()
      this.rebuildUpgradePanel()
    })

    this.updateTabs()
  }

  // ── 3D Preview ────────────────────────────────────────────────────────────────

  private initPreviewRenderer(canvas: HTMLCanvasElement): void {
    try {
      this.previewRenderer = new THREE.WebGLRenderer({
        canvas, antialias: true, alpha: true,
      })
      this.previewRenderer.setSize(1284, 560)
      this.previewRenderer.setClearColor(0x000000, 0)

      this.previewScene  = new THREE.Scene()
      this.previewCamera = new THREE.PerspectiveCamera(42, 1284 / 560, 0.01, 20)
      this.previewCamera.position.set(0.45, 0.22, 0.65)
      this.previewCamera.lookAt(0, -0.01, 0)

      // Lights
      const amb = new THREE.AmbientLight(0x88aacc, 0.55)
      this.previewScene.add(amb)
      const key = new THREE.DirectionalLight(0xfff6e8, 2.0)
      key.position.set(2, 3, 2); this.previewScene.add(key)
      const fill = new THREE.DirectionalLight(0x4466cc, 0.45)
      fill.position.set(-3, 0, -2); this.previewScene.add(fill)
      const ground = new THREE.DirectionalLight(0x223311, 0.25)
      ground.position.set(0, -3, 0); this.previewScene.add(ground)

      this.previewMesh = new THREE.Group()
      this.previewScene.add(this.previewMesh)
    } catch {
      this.previewRenderer = null
    }
  }

  private updatePreview3D(category: string, name: string): void {
    if (!this.previewMesh || !this.previewRenderer) return
    // Clear old meshes
    while (this.previewMesh.children.length > 0) {
      const c = this.previewMesh.children[0]
      if (!c) break
      this.previewMesh.remove(c)
    }
    const wm = buildWeaponMesh(category)
    this.previewMesh.add(wm)
    this.previewMesh.rotation.y = 0.6   // start at a nice angle

    if (this.previewNameEl) this.previewNameEl.textContent = name.toUpperCase()
    if (this.previewCatEl)  {
      this.previewCatEl.textContent = category
      const catColors: Record<string, string> = {
        rifle:'#4fc3f7', smg:'#81d4fa', sniper:'#ce93d8',
        shotgun:'#ffcc80', pistol:'#a5d6a7', explosive:'#ef9a9a',
      }
      this.previewCatEl.style.color = (catColors[category] ?? '#90a4ae') + 'cc'
    }
  }

  private animate3D = (): void => {
    if (!this._open || !this.previewRenderer || !this.previewScene || !this.previewCamera) return
    this.previewAnimId = requestAnimationFrame(this.animate3D)
    if (this.previewMesh) this.previewMesh.rotation.y += 0.009
    this.previewRenderer.render(this.previewScene, this.previewCamera)
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  isOpen(): boolean { return this._open }

  // ── Show / Hide ───────────────────────────────────────────────────────────────

  private show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    this.rebuild()
    // Start 3D preview with active weapon
    const active = this.mgr.activeWeapon()
    if (active) this.updatePreview3D(active.getCategory(), active.getName())
    this.animate3D()
  }

  private hide(): void {
    this._open    = false
    this.selected = null
    this.overlay.style.display = 'none'
    cancelAnimationFrame(this.previewAnimId)
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  private updateTabs(): void {
    const activeStyle   = { borderColor: 'rgba(255,215,0,0.6)', background: 'rgba(255,215,0,0.1)', color: '#ffd700' }
    const inactiveStyle = { borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }

    Object.assign(this.tabAtt.style, this.rightMode === 'attachments' ? activeStyle : inactiveStyle)
    Object.assign(this.tabUpg.style, this.rightMode === 'upgrades'    ? activeStyle : inactiveStyle)

    const attScroll = (this.tabAtt as HTMLElement & { _scroll?: HTMLElement })['_scroll']
    const upgScroll = (this.tabUpg as HTMLElement & { _scroll?: HTMLElement })['_scroll']
    if (attScroll) attScroll.style.display = this.rightMode === 'attachments' ? 'block' : 'none'
    if (upgScroll) upgScroll.style.display = this.rightMode === 'upgrades'    ? 'block' : 'none'
  }

  private rebuild(): void {
    for (let i = 0; i < 3; i++) this.refreshSlotCard(i as 0 | 1 | 2)

    this.bpList.innerHTML = ''
    const bp = this.mgr.backpack
    if (bp.length === 0) {
      const empty = document.createElement('div')
      Object.assign(empty.style, { color: 'rgba(255,255,255,0.22)', fontSize: '12px', padding: '12px' })
      empty.textContent = 'Backpack is empty'
      this.bpList.appendChild(empty)
    } else {
      bp.forEach((w, idx) => this.bpList.appendChild(this.makeBackpackCard(w, idx)))
    }

    this.rebuildAttachPanel()
    this.rebuildUpgradePanel()
    this.updateTabs()
  }

  // ── Upgrade panel ─────────────────────────────────────────────────────────────

  private rebuildUpgradePanel(): void {
    this.upgradePanel.innerHTML = ''

    // Cash balance
    const cashRow = document.createElement('div')
    Object.assign(cashRow.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: '16px',
    })
    const cashLabel = document.createElement('div')
    Object.assign(cashLabel.style, { fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '.18em' })
    cashLabel.textContent = 'AVAILABLE FUNDS'
    const cashAmt = document.createElement('div')
    Object.assign(cashAmt.style, { fontSize: '16px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '.04em' })
    cashAmt.textContent = `$${this.cash.cash.toLocaleString()}`
    cashRow.appendChild(cashLabel); cashRow.appendChild(cashAmt)
    this.upgradePanel.appendChild(cashRow)

    for (const def of UPGRADE_DEFS) {
      const tier    = this.upgrades.getTier(def.id)
      const maxTier = this.upgrades.maxTier(def.id)
      const cost    = this.upgrades.nextCost(def.id)
      const canBuy  = tier < maxTier && this.cash.cash >= cost
      const maxed   = tier >= maxTier

      // Card
      const card = document.createElement('div')
      Object.assign(card.style, {
        border: `1px solid ${maxed ? 'rgba(100,220,100,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '3px', padding: '12px 14px', marginBottom: '10px',
        background: maxed ? 'rgba(100,220,100,0.05)' : 'rgba(255,255,255,0.03)',
      })

      // Header row
      const hdr = document.createElement('div')
      Object.assign(hdr.style, { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' })
      const lbl = document.createElement('div')
      Object.assign(lbl.style, { fontSize: '10px', letterSpacing: '.16em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' })
      lbl.textContent = def.label
      const tierBadge = document.createElement('div')
      Object.assign(tierBadge.style, { fontSize: '9px', color: maxed ? '#6fef8f' : 'rgba(255,255,255,0.3)', letterSpacing: '.1em' })
      tierBadge.textContent = maxed ? 'MAXED' : `${tier} / ${maxTier}`
      hdr.appendChild(lbl); hdr.appendChild(tierBadge)
      card.appendChild(hdr)

      // Tier pip bar
      const pips = document.createElement('div')
      Object.assign(pips.style, { display: 'flex', gap: '4px', marginBottom: '10px' })
      for (let i = 0; i < maxTier; i++) {
        const pip = document.createElement('div')
        Object.assign(pip.style, {
          flex: '1', height: '4px', borderRadius: '2px',
          background: i < tier ? '#ffd700' : 'rgba(255,255,255,0.1)',
        })
        pips.appendChild(pip)
      }
      card.appendChild(pips)

      if (!maxed) {
        // Next tier description + buy button
        const nextDef = def.tiers[tier]
        const row = document.createElement('div')
        Object.assign(row.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' })
        const desc = document.createElement('div')
        Object.assign(desc.style, { fontSize: '10px', color: 'rgba(255,255,255,0.55)' })
        desc.textContent = nextDef?.description ?? ''
        const btn = document.createElement('button')
        btn.className = 'att-buy-btn' + (canBuy ? '' : ' cant-afford')
        btn.textContent = `BUY $${cost}`
        if (canBuy) btn.addEventListener('click', () => {
          if (this.cash.spend(cost)) {
            this.upgrades.upgrade(def.id)
            bus.emit('upgradeApplied', { id: def.id })
            this.rebuildUpgradePanel()
          }
        })
        row.appendChild(desc); row.appendChild(btn)
        card.appendChild(row)
      }

      this.upgradePanel.appendChild(card)
    }
  }

  // ── Attachment panel ──────────────────────────────────────────────────────────

  private rebuildAttachPanel(): void {
    this.attPanel.innerHTML = ''

    // Use the active weapon as the target for attachments
    const w = this.mgr.activeWeapon()
    if (!w) {
      const none = document.createElement('div')
      Object.assign(none.style, { color: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '8px' })
      none.textContent = 'No weapon equipped'
      this.attPanel.appendChild(none)
      return
    }

    // Weapon name + cash balance
    const weaponRow = document.createElement('div')
    Object.assign(weaponRow.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: '14px',
    })
    const wName = document.createElement('div')
    Object.assign(wName.style, { fontSize: '13px', fontWeight: 'bold', color: '#fff', letterSpacing: '.05em' })
    wName.textContent = w.getName()
    const cashBadge = document.createElement('div')
    Object.assign(cashBadge.style, { fontSize: '13px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '.04em' })
    cashBadge.textContent = `$${this.cash.cash.toLocaleString()}`
    weaponRow.appendChild(wName)
    weaponRow.appendChild(cashBadge)
    this.attPanel.appendChild(weaponRow)

    const supportedSlots = w.getStats().attachmentSlots
    if (!supportedSlots || supportedSlots.length === 0) {
      const noSlot = document.createElement('div')
      Object.assign(noSlot.style, { color: 'rgba(255,255,255,0.2)', fontSize: '11px' })
      noSlot.textContent = 'This weapon has no attachment slots'
      this.attPanel.appendChild(noSlot)
      return
    }

    for (const slot of SLOT_ORDER) {
      if (!supportedSlots.includes(slot)) continue

      const hdr = document.createElement('div')
      hdr.className = 'att-slot-header'
      hdr.textContent = SLOT_LABEL[slot]
      this.attPanel.appendChild(hdr)

      const equipped = w.getAttachment(slot)
      if (equipped) {
        this.attPanel.appendChild(this.makeAttachRow(equipped, 'equipped', w, slot))
      }
      for (const att of AttachmentRegistry.bySlot(slot)) {
        if (equipped?.id === att.id) continue
        const canAfford = this.cash.cash >= att.cost
        this.attPanel.appendChild(this.makeAttachRow(att, canAfford ? 'buy' : 'cant-afford', w, slot))
      }
    }

    // ── Supplies section ──────────────────────────────────────────────────────
    const supHdr = document.createElement('div')
    supHdr.className = 'att-slot-header'
    supHdr.textContent = 'SUPPLIES'
    this.attPanel.appendChild(supHdr)

    this.attPanel.appendChild(this.makeSupplyRow(
      'Frag Grenade', `${this.grenades.count} carried`,
      '$50 · +1 grenade',
      50,
      () => { this.grenades.addGrenades(1); this.rebuildAttachPanel() },
    ))

    // Ghillie suit — equip/unequip toggle
    const ghillieOwned = ghillie.equipped
    this.attPanel.appendChild(this.makeGhillieRow(ghillieOwned))
  }

  private makeGhillieRow(owned: boolean): HTMLElement {
    const row = document.createElement('div')
    row.className = 'att-row'

    const info = document.createElement('div')
    Object.assign(info.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1' })
    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, { fontSize: '11px', color: owned ? '#6fef8f' : '#d0d0d0' })
    nameEl.textContent = 'Ghillie Suit'
    const sub = document.createElement('div')
    Object.assign(sub.style, { fontSize: '9px', color: 'rgba(255,255,255,0.38)' })
    sub.textContent = owned ? '✓ EQUIPPED — detection –65% while prone' : 'Detection –65% while prone'
    info.appendChild(nameEl); info.appendChild(sub)
    row.appendChild(info)

    const right = document.createElement('div')
    Object.assign(right.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' })

    if (owned) {
      const btn = document.createElement('button')
      btn.className = 'att-buy-btn unequip'
      btn.textContent = 'REMOVE'
      btn.addEventListener('click', () => { ghillie.unequip(); this.rebuildAttachPanel() })
      right.appendChild(btn)
    } else {
      const costEl = document.createElement('div')
      Object.assign(costEl.style, { fontSize: '10px', color: '#ffd700', letterSpacing: '.05em' })
      costEl.textContent = '$300'
      right.appendChild(costEl)

      const canAfford = this.cash.cash >= 300
      const btn = document.createElement('button')
      btn.className = 'att-buy-btn' + (canAfford ? '' : ' cant-afford')
      btn.textContent = 'BUY $300'
      if (canAfford) btn.addEventListener('click', () => {
        if (this.cash.spend(300)) { ghillie.equip(); this.rebuildAttachPanel() }
      })
      right.appendChild(btn)
    }

    row.appendChild(right)
    return row
  }

  private makeSupplyRow(
    name: string, subtext: string, desc: string,
    cost: number, onBuy: () => void,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'att-row'

    const info = document.createElement('div')
    Object.assign(info.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1' })
    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, { fontSize: '11px', color: '#d0d0d0' })
    nameEl.textContent = name
    const sub = document.createElement('div')
    Object.assign(sub.style, { fontSize: '9px', color: 'rgba(255,255,255,0.38)' })
    sub.textContent = subtext
    info.appendChild(nameEl); info.appendChild(sub)
    row.appendChild(info)

    const right = document.createElement('div')
    Object.assign(right.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' })
    const descEl = document.createElement('div')
    Object.assign(descEl.style, { fontSize: '9px', color: 'rgba(255,255,255,0.35)' })
    descEl.textContent = desc
    right.appendChild(descEl)

    const btn = document.createElement('button')
    const canAfford = this.cash.cash >= cost
    btn.className = 'att-buy-btn' + (canAfford ? '' : ' cant-afford')
    btn.textContent = `BUY $${cost}`
    if (canAfford) btn.addEventListener('click', () => {
      if (this.cash.spend(cost)) onBuy()
    })
    right.appendChild(btn)
    row.appendChild(right)
    return row
  }

  private makeAttachRow(
    att: AttachmentDef,
    mode: 'equipped' | 'buy' | 'cant-afford',
    w: WeaponBase,
    slot: AttachmentSlot,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'att-row'

    const info = document.createElement('div')
    Object.assign(info.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' })

    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, {
      fontSize: '11px', color: mode === 'equipped' ? '#6fef8f' : '#d0d0d0',
      fontWeight: mode === 'equipped' ? 'bold' : 'normal', whiteSpace: 'nowrap',
    })
    nameEl.textContent = att.name

    const descEl = document.createElement('div')
    Object.assign(descEl.style, { fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '.02em' })
    descEl.textContent = att.description

    info.appendChild(nameEl)
    info.appendChild(descEl)
    row.appendChild(info)

    const rightSide = document.createElement('div')
    Object.assign(rightSide.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: '0' })

    if (mode === 'equipped') {
      const equipped = document.createElement('div')
      Object.assign(equipped.style, { fontSize: '9px', color: '#6fef8f', letterSpacing: '.1em' })
      equipped.textContent = '✓ EQUIPPED'
      rightSide.appendChild(equipped)

      const unequipBtn = document.createElement('button')
      unequipBtn.className = 'att-buy-btn unequip'
      unequipBtn.textContent = 'REMOVE'
      unequipBtn.addEventListener('click', () => {
        w.removeAttachment(slot)
        this.rebuildAttachPanel()
      })
      rightSide.appendChild(unequipBtn)
    } else {
      const costEl = document.createElement('div')
      Object.assign(costEl.style, { fontSize: '10px', color: '#ffd700', letterSpacing: '.05em' })
      costEl.textContent = `$${att.cost}`
      rightSide.appendChild(costEl)

      const buyBtn = document.createElement('button')
      buyBtn.className = 'att-buy-btn' + (mode === 'cant-afford' ? ' cant-afford' : '')
      buyBtn.textContent = 'BUY'
      if (mode === 'buy') {
        buyBtn.addEventListener('click', () => {
          if (this.cash.spend(att.cost)) {
            w.equipAttachment(att)
            this.rebuildAttachPanel()
          }
        })
      }
      rightSide.appendChild(buyBtn)
    }

    row.appendChild(rightSide)
    return row
  }

  // ── Slot card ─────────────────────────────────────────────────────────────────

  private makeSlotCard(slot: 0 | 1 | 2): HTMLElement {
    const card = document.createElement('div')
    Object.assign(card.style, {
      width: '200px', minHeight: '130px',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '4px', padding: '14px 16px',
      background: 'rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column', gap: '6px',
      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      position: 'relative',
    })
    card.addEventListener('click', () => this.onSlotClick(slot, card))
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.mgr.holsterSlot(slot)
      this.selected = null
      this.rebuild()
    })
    card.addEventListener('mouseenter', () => {
      if (this.selected !== slot) card.style.background = 'rgba(255,255,255,0.07)'
    })
    card.addEventListener('mouseleave', () => {
      if (this.selected !== slot) card.style.background = 'rgba(255,255,255,0.04)'
    })
    this.fillSlotCard(card, slot)
    return card
  }

  private refreshSlotCard(slot: 0 | 1 | 2): void {
    const card = this.slotEls[slot]
    if (!card) return
    card.innerHTML = ''
    this.fillSlotCard(card, slot)
    const isSel = this.selected === slot
    card.style.borderColor = isSel ? '#ffc107' : 'rgba(255,255,255,0.12)'
    card.style.background  = isSel ? 'rgba(255,193,7,0.08)' : 'rgba(255,255,255,0.04)'
  }

  private fillSlotCard(card: HTMLElement, slot: 0 | 1 | 2): void {
    const labels = ['1  RIFLE / PRIMARY', '2  SECONDARY', '3  SIDEARM']
    const label = document.createElement('div')
    Object.assign(label.style, {
      fontSize: '9px', letterSpacing: '.14em',
      color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '2px',
    })
    label.textContent = labels[slot] ?? `SLOT ${slot + 1}`
    card.appendChild(label)

    const w = this.mgr.slots[slot]
    if (!w) {
      const empty = document.createElement('div')
      Object.assign(empty.style, { color: 'rgba(255,255,255,0.2)', fontSize: '13px', marginTop: '12px' })
      empty.textContent = '[ EMPTY ]'
      card.appendChild(empty)
    } else {
      this.appendWeaponInfo(card, w)
    }

    if (slot === this.mgr.getCurrentSlot() && w) {
      const dot = document.createElement('div')
      Object.assign(dot.style, {
        position: 'absolute', top: '10px', right: '12px',
        width: '6px', height: '6px', borderRadius: '50%', background: '#4caf50',
      })
      card.appendChild(dot)
    }
  }

  // ── Backpack card ─────────────────────────────────────────────────────────────

  private makeBackpackCard(w: WeaponBase, idx: number): HTMLElement {
    const card = document.createElement('div')
    const cc   = catColor(w.getCategory())
    Object.assign(card.style, {
      width: '196px', minHeight: '110px',
      border: `1px solid ${cc}44`,
      borderRadius: '4px', padding: '12px 14px',
      background: 'rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column', gap: '5px',
      cursor: this.selected !== null ? 'pointer' : 'default',
      transition: 'border-color 0.15s, background 0.15s',
    })
    card.addEventListener('mouseenter', () => {
      this.updatePreview3D(w.getCategory(), w.getName())
      if (this.selected !== null) {
        card.style.borderColor = cc
        card.style.background  = `${cc}14`
      }
    })
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = `${cc}44`
      card.style.background  = 'rgba(255,255,255,0.03)'
    })
    card.addEventListener('click', () => {
      if (this.selected === null) return
      this.mgr.swapBackpackIntoSlot(idx, this.selected)
      this.selected = null
      this.rebuild()
    })
    this.appendWeaponInfo(card, w)
    return card
  }

  // ── Shared weapon info block ──────────────────────────────────────────────────

  private appendWeaponInfo(parent: HTMLElement, w: WeaponBase): void {
    const cc = catColor(w.getCategory())

    const badge = document.createElement('div')
    Object.assign(badge.style, {
      fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', color: cc, marginBottom: '1px',
    })
    badge.textContent = w.getCategory()
    parent.appendChild(badge)

    const name = document.createElement('div')
    Object.assign(name.style, {
      fontSize: '14px', fontWeight: 'bold', letterSpacing: '.04em', color: '#fff', lineHeight: '1.2',
    })
    name.textContent = w.getName()
    parent.appendChild(name)

    const statsRow = document.createElement('div')
    Object.assign(statsRow.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginTop: '6px',
    })
    const stats: [string, string][] = [
      ['DMG',  String(w.getDamage())],
      ['RoF',  String(w.getRoF())],
      ['MAG',  String(w.getMagSize())],
      ['AMMO', `${w.getAmmo()} + ${w.getReserve()}`],
    ]
    for (const [k, v] of stats) {
      const kEl = document.createElement('span')
      Object.assign(kEl.style, { fontSize: '10px', color: 'rgba(255,255,255,0.38)' })
      kEl.textContent = k
      const vEl = document.createElement('span')
      Object.assign(vEl.style, { fontSize: '10px', color: 'rgba(255,255,255,0.75)' })
      vEl.textContent = v
      statsRow.appendChild(kEl)
      statsRow.appendChild(vEl)
    }
    parent.appendChild(statsRow)

    // Show equipped attachments as compact chips
    const atts = w.getAttachments()
    if (atts.size > 0) {
      const chips = document.createElement('div')
      Object.assign(chips.style, { display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '5px' })
      for (const att of atts.values()) {
        const chip = document.createElement('span')
        Object.assign(chip.style, {
          fontSize: '8px', padding: '1px 5px', borderRadius: '2px',
          background: 'rgba(100,220,100,0.12)', color: 'rgba(100,220,100,0.8)',
          border: '1px solid rgba(100,220,100,0.25)', letterSpacing: '.06em',
        })
        chip.textContent = att.name
        chips.appendChild(chip)
      }
      parent.appendChild(chips)
    }
  }

  // ── Slot click logic ──────────────────────────────────────────────────────────

  private onSlotClick(slot: 0 | 1 | 2, _card: HTMLElement): void {
    if (this.selected === null) {
      this.selected = slot
    } else if (this.selected === slot) {
      this.selected = null
    } else {
      this.mgr.swapSlots(this.selected, slot)
      this.selected = null
    }
    // Update 3D preview for the selected slot's weapon
    const w = this.mgr.slots[this.selected ?? slot]
    if (w) this.updatePreview3D(w.getCategory(), w.getName())
    this.rebuild()
  }
}
