import { Settings }       from '../core/Settings'
import { defaultKeyMap }  from '../input/InputMap'
import type { AudioSystem } from '../audio/AudioSystem'

const LABEL: Record<string, string> = {
  moveForward:  'Move Forward',
  moveBack:     'Move Backward',
  moveLeft:     'Strafe Left',
  moveRight:    'Strafe Right',
  jump:         'Jump',
  sprint:       'Sprint',
  crouch:       'Crouch',
  prone:        'Prone',
  reload:       'Reload',
  interact:     'Interact / Enter Vehicle',
  melee:        'Melee',
  grenade:      'Throw Grenade',
  parry:        'Parry',
  dash:         'Dash',
  weapon1:      'Primary Weapon',
  weapon2:      'Secondary Weapon',
  sidearm:      'Sidearm',
  vehicleExit:  'Exit Vehicle',
}

const KEY_DISPLAY: Record<string, string> = {
  Space: 'Space', ShiftLeft: 'Shift', ControlLeft: 'Ctrl',
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
  KeyC: 'C', KeyZ: 'Z', KeyR: 'R', KeyE: 'E',
  KeyV: 'V', KeyG: 'G', KeyQ: 'Q', KeyF: 'F',
  Digit1: '1', Digit2: '2', Digit3: '3', F5: 'F5',
}

export class SettingsMenu {
  private overlay:  HTMLElement
  private _open     = false

  constructor(private audio: AudioSystem) {
    this.overlay = this.build()
    document.body.appendChild(this.overlay)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyI') {
        e.preventDefault()
        this._open ? this.hide() : this.show()
      }
      if (e.code === 'Escape' && this._open) this.hide()
    })
  }

  isOpen(): boolean { return this._open }

  private show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    document.exitPointerLock()
  }

  private hide(): void {
    this._open = false
    this.overlay.style.display = 'none'
  }

  private build(): HTMLElement {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position:       'fixed', inset: '0',
      display:        'none',
      alignItems:     'center', justifyContent: 'center',
      background:     'rgba(0,0,0,0.82)',
      zIndex:         '200',
      fontFamily:     'monospace',
      overflowY:      'auto',
    })

    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background:   'rgba(10,14,10,0.97)',
      border:       '1px solid rgba(100,140,80,0.35)',
      borderRadius: '4px',
      padding:      '28px 36px',
      minWidth:     '420px',
      maxWidth:     '520px',
      color:        '#c8d4b8',
    })

    // Title
    const title = document.createElement('div')
    Object.assign(title.style, {
      fontSize: '11px', letterSpacing: '0.38em', color: '#7ab860',
      marginBottom: '22px', textTransform: 'uppercase',
    })
    title.textContent = 'SETTINGS'
    panel.appendChild(title)

    // ── AUDIO ──────────────────────────────────────────────────────────────────
    panel.appendChild(this.sectionHeader('AUDIO'))

    panel.appendChild(this.slider(
      'Master Volume', Settings.masterVolume,
      v => this.audio.setMasterVolume(v),
    ))
    panel.appendChild(this.slider(
      'Music Volume', Settings.musicVolume,
      v => this.audio.setMusicVolume(v),
    ))
    panel.appendChild(this.slider(
      'SFX Volume', Settings.sfxVolume,
      v => this.audio.setSfxVolume(v),
    ))

    // ── CONTROLS ───────────────────────────────────────────────────────────────
    panel.appendChild(this.sectionHeader('CONTROLS'))

    panel.appendChild(this.slider(
      'Mouse Sensitivity', Settings.mouseSensitivity / 0.006,
      v => { Settings.mouseSensitivity = v * 0.006 },
    ))

    // Key bindings table
    const table = document.createElement('div')
    Object.assign(table.style, {
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: '4px 16px', marginTop: '10px',
    })

    // Build reverse map: action → key code
    const actionToKey = new Map<string, string>()
    for (const [code, action] of Object.entries(defaultKeyMap)) {
      actionToKey.set(action, code)
    }

    for (const [action, label] of Object.entries(LABEL)) {
      const keyCode  = actionToKey.get(action) ?? ''
      const keyLabel = KEY_DISPLAY[keyCode] ?? keyCode.replace('Key', '')

      const lbl = document.createElement('div')
      Object.assign(lbl.style, { fontSize: '9px', color: 'rgba(200,212,184,0.7)', alignSelf: 'center' })
      lbl.textContent = label

      const key = document.createElement('div')
      Object.assign(key.style, {
        fontSize: '9px', padding: '2px 8px',
        border: '1px solid rgba(120,160,90,0.35)',
        borderRadius: '2px', textAlign: 'center',
        color: '#7ab860', minWidth: '40px',
      })
      key.textContent = keyLabel

      table.appendChild(lbl)
      table.appendChild(key)
    }
    panel.appendChild(table)

    // Close button
    const closeBtn = document.createElement('button')
    Object.assign(closeBtn.style, {
      marginTop: '22px', display: 'block', width: '100%',
      padding: '7px', background: 'rgba(100,140,80,0.12)',
      border: '1px solid rgba(100,140,80,0.4)', borderRadius: '2px',
      color: '#7ab860', fontFamily: 'monospace', fontSize: '9px',
      letterSpacing: '0.25em', cursor: 'pointer',
    })
    closeBtn.textContent = 'CLOSE  [ I ]'
    closeBtn.addEventListener('click', () => this.hide())
    panel.appendChild(closeBtn)

    overlay.appendChild(panel)
    return overlay
  }

  private sectionHeader(text: string): HTMLElement {
    const h = document.createElement('div')
    Object.assign(h.style, {
      fontSize: '8px', letterSpacing: '0.30em', color: 'rgba(122,184,96,0.65)',
      borderBottom: '1px solid rgba(100,140,80,0.2)',
      paddingBottom: '4px', marginTop: '18px', marginBottom: '10px',
    })
    h.textContent = text
    return h
  }

  private slider(label: string, initial: number, onChange: (v: number) => void): HTMLElement {
    const row = document.createElement('div')
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' })

    const lbl = document.createElement('div')
    Object.assign(lbl.style, { fontSize: '9px', flex: '1', color: 'rgba(200,212,184,0.8)' })
    lbl.textContent = label

    const pct = document.createElement('div')
    Object.assign(pct.style, { fontSize: '9px', width: '32px', textAlign: 'right', color: '#7ab860' })
    pct.textContent = `${Math.round(initial * 100)}%`

    const inp = document.createElement('input')
    inp.type  = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.01'
    inp.value = String(Math.max(0, Math.min(1, initial)))
    Object.assign(inp.style, { width: '120px', accentColor: '#7ab860', cursor: 'pointer' })

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value)
      pct.textContent = `${Math.round(v * 100)}%`
      onChange(v)
    })

    row.appendChild(lbl)
    row.appendChild(inp)
    row.appendChild(pct)
    return row
  }
}
