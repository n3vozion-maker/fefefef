import { Settings } from '../core/Settings'

export class PauseMenu {
  private overlay:  HTMLElement
  private _paused   = false
  private onResume: () => void

  constructor(onResume: () => void) {
    this.onResume = onResume

    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff', zIndex: '90',
    })

    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '4px', padding: '40px 56px', minWidth: '340px',
      display: 'flex', flexDirection: 'column', gap: '20px',
    })

    panel.appendChild(this.heading('PAUSED'))
    panel.appendChild(this.divider())

    // Sensitivity
    panel.appendChild(this.label('Mouse Sensitivity'))
    panel.appendChild(this.slider(0.0005, 0.006, Settings.mouseSensitivity, (v) => {
      Settings.mouseSensitivity = v
    }))

    // Volume
    panel.appendChild(this.label('Master Volume'))
    panel.appendChild(this.slider(0, 1, Settings.masterVolume, (v) => {
      Settings.masterVolume = v
      try {
        // Howler.volume is loaded lazily
        ;(window as unknown as Record<string,unknown>)['Howler'] &&
          (window as unknown as { Howler: { volume(v:number):void } }).Howler.volume(v)
      } catch { /* */ }
    }))

    panel.appendChild(this.divider())

    // Keybinds display
    panel.appendChild(this.label('Keybinds', '11px', 'rgba(255,255,255,0.45)'))
    const binds: [string, string][] = [
      ['WASD', 'Move'],       ['Shift', 'Sprint'],
      ['C', 'Crouch / Slide'],['Space', 'Jump / Vault'],
      ['Mouse', 'Look / Fire'],['Right Click', 'ADS'],
      ['R', 'Reload'],        ['G', 'Grenade'],
      ['1/2/3', 'Weapons'],   ['M', 'Missions'],
      ['F5', 'Quicksave'],    ['ESC', 'Pause'],
    ]
    const grid = document.createElement('div')
    Object.assign(grid.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gap: '4px 20px', fontSize: '11px', color: 'rgba(255,255,255,0.6)',
    })
    for (const [key, action] of binds) {
      const row = document.createElement('div')
      row.style.display = 'flex'; row.style.justifyContent = 'space-between'
      const k = document.createElement('span'); k.style.color = '#aaa'; k.textContent = key
      const a = document.createElement('span'); a.textContent = action
      row.appendChild(k); row.appendChild(a)
      grid.appendChild(row)
    }
    panel.appendChild(grid)

    panel.appendChild(this.divider())
    panel.appendChild(this.btn('Resume  [ ESC ]', () => this.hide()))

    this.overlay.appendChild(panel)
    document.body.appendChild(this.overlay)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this._paused ? this.hide() : this.show()
    })
  }

  get paused(): boolean { return this._paused }

  private show(): void {
    this._paused = true
    this.overlay.style.display = 'flex'
  }

  private hide(): void {
    this._paused = false
    this.overlay.style.display = 'none'
    this.onResume()
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private heading(text: string): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, { fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.18em', textAlign: 'center' })
    el.textContent = text
    return el
  }

  private divider(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, { height: '1px', background: 'rgba(255,255,255,0.1)' })
    return el
  }

  private label(text: string, size = '12px', color = 'rgba(255,255,255,0.7)'): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, { fontSize: size, color, letterSpacing: '0.08em', textTransform: 'uppercase' })
    el.textContent = text
    return el
  }

  private slider(min: number, max: number, initial: number, onChange: (v: number) => void): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.gap = '10px'

    const input = document.createElement('input')
    input.type  = 'range'
    input.min   = String(min); input.max = String(max); input.step = String((max - min) / 200)
    input.value = String(initial)
    Object.assign(input.style, { flex: '1', accentColor: '#4caf50', cursor: 'pointer' })

    const val = document.createElement('span')
    val.style.fontSize  = '11px'; val.style.color = '#aaa'; val.style.minWidth = '36px'
    val.textContent = ((initial / max) * 100).toFixed(0) + '%'

    input.addEventListener('input', () => {
      const v = parseFloat(input.value)
      val.textContent = ((v / max) * 100).toFixed(0) + '%'
      onChange(v)
    })
    wrap.appendChild(input); wrap.appendChild(val)
    return wrap
  }

  private btn(text: string, onClick: () => void): HTMLElement {
    const el = document.createElement('button')
    Object.assign(el.style, {
      background: 'none', border: '1px solid rgba(255,255,255,0.25)',
      color: '#fff', fontFamily: 'monospace', fontSize: '13px',
      padding: '10px', cursor: 'pointer', letterSpacing: '0.1em',
      borderRadius: '3px', transition: 'border-color 0.15s',
    })
    el.textContent = text
    el.addEventListener('mouseenter', () => { el.style.borderColor = '#4caf50' })
    el.addEventListener('mouseleave', () => { el.style.borderColor = 'rgba(255,255,255,0.25)' })
    el.addEventListener('click', onClick)
    return el
  }
}
