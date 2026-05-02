import { Settings } from '../core/Settings'
import { bus }      from '../core/EventBus'
import { defaultKeyMap } from '../input/InputMap'

// ── Key display labels ─────────────────────────────────────────────────────────
const KEY_DISPLAY: Record<string, string> = {
  Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt',
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyC: 'C', KeyZ: 'Z',
  KeyR: 'R', KeyE: 'E', KeyV: 'V', KeyG: 'G', KeyQ: 'Q', KeyF: 'F', KeyI: 'I',
  Digit1: '1', Digit2: '2', Digit3: '3', F5: 'F5', Escape: 'ESC',
}
const ACTION_LABEL: Record<string, string> = {
  moveForward:  'Move Forward',   moveBack:    'Move Backward',
  moveLeft:     'Strafe Left',    moveRight:   'Strafe Right',
  jump:         'Jump / Vault',   sprint:      'Sprint',
  crouch:       'Crouch / Slide', prone:       'Prone',
  reload:       'Reload',         interact:    'Interact / Enter Vehicle',
  melee:        'Melee',          grenade:     'Throw Grenade',
  parry:        'Parry / Block',  dash:        'Dash',
  weapon1:      'Primary Weapon', weapon2:     'Secondary Weapon',
  sidearm:      'Sidearm',        vehicleExit: 'Exit Vehicle',
}

type Page = 'main' | 'video' | 'controls'

// ── PauseMenu ─────────────────────────────────────────────────────────────────

export class PauseMenu {
  private overlay:   HTMLElement
  private sidebar:   HTMLElement
  private content:   HTMLElement
  private _paused    = false
  private page:      Page = 'main'
  private navBtns:   Map<Page, HTMLElement> = new Map()
  private onResume: () => void

  constructor(onResume: () => void) {
    this.onResume = onResume

    // ── CSS ──────────────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      @keyframes pause-in { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
      .pm-overlay {
        position:fixed; inset:0; display:none;
        background:rgba(0,0,0,0.82); backdrop-filter:blur(8px);
        align-items:center; justify-content:center;
        z-index:90; font-family:monospace;
      }
      .pm-panel {
        display:flex; flex-direction:row;
        background:rgba(8,10,8,0.97);
        border:1px solid rgba(80,160,80,0.2);
        border-radius:6px; overflow:hidden;
        min-height:540px; max-height:85vh;
        animation:pause-in 0.16s ease-out;
        box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(80,180,80,0.08);
      }
      .pm-sidebar {
        width:190px; flex-shrink:0;
        background:rgba(0,8,0,0.6);
        border-right:1px solid rgba(80,160,80,0.14);
        display:flex; flex-direction:column;
        padding:30px 0 20px;
      }
      .pm-logo {
        text-align:center; padding:0 16px 28px;
        border-bottom:1px solid rgba(80,160,80,0.12);
        margin-bottom:20px;
      }
      .pm-logo-title {
        font-size:18px; font-weight:bold; letter-spacing:.25em;
        color:#7dc460; text-shadow:0 0 18px rgba(80,200,60,0.35);
      }
      .pm-logo-sub {
        font-size:8px; letter-spacing:.4em; color:rgba(150,200,120,0.35);
        margin-top:3px;
      }
      .pm-nav-btn {
        display:flex; align-items:center; gap:10px;
        padding:11px 22px; cursor:pointer;
        border:none; background:none;
        font-family:monospace; font-size:10px; letter-spacing:.2em;
        text-transform:uppercase; color:rgba(180,210,160,0.5);
        text-align:left; transition:all 0.14s;
        border-left:2px solid transparent;
      }
      .pm-nav-btn:hover { color:rgba(180,220,150,0.85); background:rgba(80,160,60,0.08); }
      .pm-nav-btn.active {
        color:#7dc460; background:rgba(80,180,60,0.1);
        border-left-color:#7dc460;
      }
      .pm-nav-icon { font-size:13px; opacity:0.8; }
      .pm-nav-spacer { flex:1; }
      .pm-content {
        width:420px; padding:28px 32px; overflow-y:auto; color:#c8d4b8;
      }
      .pm-page-title {
        font-size:9px; letter-spacing:.35em; color:rgba(100,180,80,0.7);
        text-transform:uppercase; margin-bottom:22px;
        padding-bottom:8px; border-bottom:1px solid rgba(80,160,60,0.2);
      }
      .pm-section { margin-bottom:22px; }
      .pm-section-title {
        font-size:8px; letter-spacing:.28em; color:rgba(100,180,80,0.5);
        text-transform:uppercase; margin-bottom:10px;
      }
      .pm-slider-row {
        display:flex; align-items:center; gap:12px;
        margin-bottom:10px;
      }
      .pm-slider-label {
        font-size:10px; color:rgba(200,220,180,0.75); flex:1; min-width:0;
      }
      .pm-slider-val {
        font-size:10px; color:#7dc460; min-width:38px; text-align:right;
      }
      .pm-slider {
        width:130px; accent-color:#7dc460; cursor:pointer;
      }
      .pm-quality-row {
        display:flex; align-items:center; gap:10px; margin-bottom:10px;
      }
      .pm-quality-label {
        font-size:10px; color:rgba(200,220,180,0.75); flex:1;
      }
      .pm-quality-btns { display:flex; gap:4px; }
      .pm-qbtn {
        padding:3px 10px; font-family:monospace; font-size:8px;
        letter-spacing:.1em; cursor:pointer; border-radius:2px;
        border:1px solid rgba(100,160,80,0.3);
        background:rgba(100,160,80,0.06); color:rgba(160,200,130,0.5);
        transition:all 0.12s;
      }
      .pm-qbtn.active {
        border-color:rgba(100,200,80,0.6);
        background:rgba(100,200,80,0.15); color:#8dc870;
      }
      .pm-toggle {
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:10px;
      }
      .pm-toggle-label {
        font-size:10px; color:rgba(200,220,180,0.75);
      }
      .pm-toggle-btn {
        padding:3px 14px; font-family:monospace; font-size:8px;
        letter-spacing:.12em; cursor:pointer; border-radius:2px;
        border:1px solid rgba(100,160,80,0.3);
        background:rgba(100,160,80,0.06); color:rgba(160,200,130,0.5);
        transition:all 0.12s;
      }
      .pm-toggle-btn.on {
        border-color:rgba(80,200,80,0.6);
        background:rgba(80,200,80,0.15); color:#8dc870;
      }
      .pm-keybinds-grid {
        display:grid; grid-template-columns:1fr 1fr;
        gap:3px 16px; margin-top:6px;
      }
      .pm-bind-row {
        display:flex; justify-content:space-between; align-items:center;
        padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);
      }
      .pm-bind-action {
        font-size:9px; color:rgba(180,210,160,0.65);
      }
      .pm-bind-key {
        font-size:9px; padding:1px 6px;
        border:1px solid rgba(100,160,80,0.3); border-radius:2px;
        color:#8dc870; min-width:32px; text-align:center;
      }
      .pm-main-btn {
        display:block; width:100%; padding:11px;
        margin-bottom:10px;
        border:1px solid rgba(100,180,80,0.25); border-radius:3px;
        background:rgba(100,180,80,0.06); color:#b0d8a0;
        font-family:monospace; font-size:11px; letter-spacing:.18em;
        cursor:pointer; transition:all 0.14s; text-align:center;
      }
      .pm-main-btn:hover { border-color:rgba(100,220,80,0.5); background:rgba(100,220,80,0.12); color:#c8eab8; }
      .pm-main-btn.accent {
        border-color:rgba(100,220,80,0.5); background:rgba(100,220,80,0.1); color:#7dc460;
        font-weight:bold;
      }
      .pm-main-btn.accent:hover { background:rgba(100,220,80,0.22); }
      .pm-main-btn.danger { border-color:rgba(200,60,60,0.3); color:rgba(220,120,120,0.7); }
      .pm-main-btn.danger:hover { border-color:rgba(220,80,80,0.55); background:rgba(200,60,60,0.1); color:#e08080; }
      .pm-divider { height:1px; background:rgba(80,160,60,0.12); margin:14px 0; }
      .pm-hint {
        font-size:8px; letter-spacing:.15em; color:rgba(120,160,100,0.4);
        text-align:center; margin-top:6px;
      }
    `
    document.head.appendChild(style)

    // ── Overlay ──────────────────────────────────────────────────────────────
    this.overlay = document.createElement('div')
    this.overlay.className = 'pm-overlay'

    const panel = document.createElement('div')
    panel.className = 'pm-panel'

    // ── Sidebar ──────────────────────────────────────────────────────────────
    this.sidebar = document.createElement('div')
    this.sidebar.className = 'pm-sidebar'

    const logo = document.createElement('div')
    logo.className = 'pm-logo'
    logo.innerHTML = `<div class="pm-logo-title">IRON ZERO</div><div class="pm-logo-sub">◈ PAUSED ◈</div>`
    this.sidebar.appendChild(logo)

    const navItems: [Page, string, string][] = [
      ['main',     '▶',  'Resume'],
      ['video',    '◉',  'Video'],
      ['controls', '⌨',  'Controls'],
    ]
    for (const [page, icon, label] of navItems) {
      const btn = document.createElement('button')
      btn.className = 'pm-nav-btn'
      btn.innerHTML = `<span class="pm-nav-icon">${icon}</span>${label}`
      btn.addEventListener('click', () => {
        if (page === 'main') { this.hide(); return }
        this.goPage(page)
      })
      this.sidebar.appendChild(btn)
      this.navBtns.set(page, btn)
    }

    const spacer = document.createElement('div')
    spacer.className = 'pm-nav-spacer'
    this.sidebar.appendChild(spacer)

    const quitBtn = document.createElement('button')
    quitBtn.className = 'pm-nav-btn'
    quitBtn.innerHTML = `<span class="pm-nav-icon">✕</span>Quit`
    quitBtn.addEventListener('click', () => {
      bus.emit('quitToMenu', undefined)
      location.reload()
    })
    this.sidebar.appendChild(quitBtn)

    // ── Content area ─────────────────────────────────────────────────────────
    this.content = document.createElement('div')
    this.content.className = 'pm-content'

    panel.appendChild(this.sidebar)
    panel.appendChild(this.content)
    this.overlay.appendChild(panel)
    document.body.appendChild(this.overlay)

    // ── ESC toggle ───────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this._paused) {
          if (this.page !== 'video' && this.page !== 'controls') {
            this.hide()
          } else {
            this.goPage('video') // stay on video, ESC closes from video too
            this.hide()
          }
        } else {
          this.show()
        }
      }
    })

    this.goPage('video') // default visible page (but menu hidden)
  }

  get paused(): boolean { return this._paused }

  // ── Show / Hide ───────────────────────────────────────────────────────────

  private show(): void {
    this._paused = true
    this.overlay.style.display = 'flex'
  }

  private hide(): void {
    this._paused = false
    this.overlay.style.display = 'none'
    this.onResume()
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  private goPage(p: Page): void {
    this.page = p
    this.navBtns.forEach((btn, key) => {
      btn.classList.toggle('active', key === p)
    })
    this.content.innerHTML = ''
    if (p === 'video')    this.buildVideo()
    if (p === 'controls') this.buildControls()
  }

  // ── Video Settings Page ───────────────────────────────────────────────────

  private buildVideo(): void {
    const c = this.content

    const title = document.createElement('div')
    title.className = 'pm-page-title'
    title.textContent = '◉  Video Settings'
    c.appendChild(title)

    // Resume hint at top
    const resumeBtn = document.createElement('button')
    resumeBtn.className = 'pm-main-btn accent'
    resumeBtn.textContent = '▶  RESUME GAME  [ ESC ]'
    resumeBtn.addEventListener('click', () => this.hide())
    c.appendChild(resumeBtn)

    const div = document.createElement('div')
    div.className = 'pm-divider'
    c.appendChild(div)

    // ── FOV ────────────────────────────────────────────────────────────────
    const section1 = document.createElement('div')
    section1.className = 'pm-section'
    section1.appendChild(this.sectionTitle('Display'))
    section1.appendChild(this.sliderRow('Field of View', 60, 120, 1, Settings.fov, (v) => {
      Settings.fov = v
      bus.emit('fovChanged', v)
    }, '°'))
    section1.appendChild(this.sliderRow('ADS Field of View', 40, 75, 1, Settings.adsFov, (v) => {
      Settings.adsFov = v
      bus.emit('adsFovChanged', v)
    }, '°'))
    c.appendChild(section1)

    // ── Quality ────────────────────────────────────────────────────────────
    const section2 = document.createElement('div')
    section2.className = 'pm-section'
    section2.appendChild(this.sectionTitle('Quality'))
    section2.appendChild(this.qualityRow('Shadow Quality', ['low', 'medium', 'high'],
      Settings.shadowQuality, (v) => { Settings.shadowQuality = v as typeof Settings.shadowQuality }))
    section2.appendChild(this.qualityRow('Graphics Quality', ['low', 'medium', 'high'],
      Settings.graphicsQuality, (v) => { Settings.graphicsQuality = v as typeof Settings.graphicsQuality }))
    c.appendChild(section2)

    // ── Audio ──────────────────────────────────────────────────────────────
    const section3 = document.createElement('div')
    section3.className = 'pm-section'
    section3.appendChild(this.sectionTitle('Audio'))
    section3.appendChild(this.sliderRow('Master Volume', 0, 1, 0.01, Settings.masterVolume, (v) => {
      Settings.masterVolume = v
      bus.emit('volumeChanged', v)
    }, '%', true))
    section3.appendChild(this.sliderRow('Music Volume', 0, 1, 0.01, Settings.musicVolume, (v) => {
      Settings.musicVolume = v
    }, '%', true))
    section3.appendChild(this.sliderRow('SFX Volume', 0, 1, 0.01, Settings.sfxVolume, (v) => {
      Settings.sfxVolume = v
    }, '%', true))
    c.appendChild(section3)

    const hint = document.createElement('div')
    hint.className = 'pm-hint'
    hint.textContent = 'Settings auto-save'
    c.appendChild(hint)
  }

  // ── Controls Page ─────────────────────────────────────────────────────────

  private buildControls(): void {
    const c = this.content

    const title = document.createElement('div')
    title.className = 'pm-page-title'
    title.textContent = '⌨  Controls'
    c.appendChild(title)

    // Resume hint
    const resumeBtn = document.createElement('button')
    resumeBtn.className = 'pm-main-btn accent'
    resumeBtn.textContent = '▶  RESUME GAME  [ ESC ]'
    resumeBtn.addEventListener('click', () => this.hide())
    c.appendChild(resumeBtn)

    const div = document.createElement('div')
    div.className = 'pm-divider'
    c.appendChild(div)

    // ── Mouse ──────────────────────────────────────────────────────────────
    const section1 = document.createElement('div')
    section1.className = 'pm-section'
    section1.appendChild(this.sectionTitle('Mouse'))
    section1.appendChild(this.sliderRow(
      'Sensitivity', 0.0005, 0.006, 0.0001, Settings.mouseSensitivity,
      (v) => { Settings.mouseSensitivity = v }, '%', false,
      (v) => Math.round((v / 0.006) * 100) + '%',
    ))
    section1.appendChild(this.toggleRow('Invert Y Axis', Settings.invertY, (v) => {
      Settings.invertY = v
      bus.emit('invertYChanged', v)
    }))
    c.appendChild(section1)

    // ── Keybinds ──────────────────────────────────────────────────────────
    const section2 = document.createElement('div')
    section2.className = 'pm-section'
    section2.appendChild(this.sectionTitle('Key Bindings'))

    const actionToKey = new Map<string, string>()
    for (const [code, action] of Object.entries(defaultKeyMap)) {
      actionToKey.set(action, code)
    }

    const grid = document.createElement('div')
    grid.className = 'pm-keybinds-grid'

    for (const [action, label] of Object.entries(ACTION_LABEL)) {
      const keyCode  = actionToKey.get(action) ?? ''
      const keyLabel = KEY_DISPLAY[keyCode] ?? keyCode.replace('Key', '').replace('Digit', '')

      const row = document.createElement('div')
      row.className = 'pm-bind-row'

      const a = document.createElement('span')
      a.className = 'pm-bind-action'
      a.textContent = label

      const k = document.createElement('span')
      k.className = 'pm-bind-key'
      k.textContent = keyLabel

      row.appendChild(a)
      row.appendChild(k)
      grid.appendChild(row)
    }
    section2.appendChild(grid)
    c.appendChild(section2)

    const hint = document.createElement('div')
    hint.className = 'pm-hint'
    hint.textContent = 'Key rebinding coming soon'
    c.appendChild(hint)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sectionTitle(text: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'pm-section-title'
    el.textContent = text
    return el
  }

  private sliderRow(
    label:    string,
    min:      number,
    max:      number,
    step:     number,
    initial:  number,
    onChange: (v: number) => void,
    suffix    = '',
    isPct     = false,
    fmtVal?: (v: number) => string,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'pm-slider-row'

    const lbl = document.createElement('div')
    lbl.className = 'pm-slider-label'
    lbl.textContent = label

    const inp = document.createElement('input')
    inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step)
    inp.value = String(initial)
    inp.className = 'pm-slider'

    const fmt = fmtVal ?? ((v: number) => isPct ? Math.round(v * 100) + suffix : Math.round(v) + suffix)
    const val = document.createElement('div')
    val.className = 'pm-slider-val'
    val.textContent = fmt(initial)

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value)
      val.textContent = fmt(v)
      onChange(v)
    })

    row.appendChild(lbl); row.appendChild(inp); row.appendChild(val)
    return row
  }

  private qualityRow(
    label:    string,
    options:  string[],
    current:  string,
    onChange: (v: string) => void,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'pm-quality-row'

    const lbl = document.createElement('div')
    lbl.className = 'pm-quality-label'
    lbl.textContent = label

    const btns = document.createElement('div')
    btns.className = 'pm-quality-btns'

    for (const opt of options) {
      const btn = document.createElement('button')
      btn.className = 'pm-qbtn' + (opt === current ? ' active' : '')
      btn.textContent = opt.charAt(0).toUpperCase() + opt.slice(1)
      btn.addEventListener('click', () => {
        btns.querySelectorAll('.pm-qbtn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        onChange(opt)
      })
      btns.appendChild(btn)
    }

    row.appendChild(lbl); row.appendChild(btns)
    return row
  }

  private toggleRow(
    label:    string,
    initial:  boolean,
    onChange: (v: boolean) => void,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'pm-toggle'

    const lbl = document.createElement('div')
    lbl.className = 'pm-toggle-label'
    lbl.textContent = label

    let state = initial
    const btn = document.createElement('button')
    btn.className = 'pm-toggle-btn' + (state ? ' on' : '')
    btn.textContent = state ? '  ON  ' : ' OFF  '

    btn.addEventListener('click', () => {
      state = !state
      btn.textContent = state ? '  ON  ' : ' OFF  '
      btn.classList.toggle('on', state)
      onChange(state)
    })

    row.appendChild(lbl); row.appendChild(btn)
    return row
  }
}
