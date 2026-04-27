import { bus } from '../core/EventBus'

// ── BossHealthBar ─────────────────────────────────────────────────────────────
// Displays at the top-centre of the screen when a boss is alive and engaged.
// Phases are shown as colour shifts. The bar pulses red when the boss enrages.

export class BossHealthBar {
  private root:    HTMLElement
  private nameEl:  HTMLElement
  private barFill: HTMLElement
  private phaseEl: HTMLElement
  private active   = false

  constructor() {
    this.root    = this.build()
    this.nameEl  = this.root.querySelector('.bhb-name')!
    this.barFill = this.root.querySelector('.bhb-fill')!
    this.phaseEl = this.root.querySelector('.bhb-phase')!

    const style = document.createElement('style')
    style.textContent = `
      @keyframes bhb-pulse { 0%,100%{box-shadow:0 0 0} 50%{box-shadow:0 0 18px #ff0000} }
      @keyframes bhb-enter { 0%{opacity:0;transform:translateX(-50%) translateY(-20px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
      .bhb-rage .bhb-fill { animation: bhb-pulse 0.6s ease-in-out infinite !important; }
    `
    document.head.appendChild(style)

    bus.on<{ id: string; health: number; maxHealth: number }>('bossDamaged', (e) => {
      this.setHP(e.health, e.maxHealth)
    })

    bus.on<{ id: string; phase: number }>('bossPhaseChange', (e) => {
      this.setPhase(e.phase)
    })

    bus.on<{ id: string; event: string; msg: string }>('bossEvent', (e) => {
      this.nameEl.textContent = e.msg.length < 36 ? e.msg : this.nameEl.textContent
    })

    bus.on<string>('bossDied', () => this.hide())

    // Show bar when boss fight starts (bossEncountered or first damage)
    bus.on('bossEncountered', (data: unknown) => {
      const d = data as { id: string; name: string; maxHealth: number }
      this.show(d.name, d.maxHealth)
    })
  }

  show(name: string, maxHealth: number): void {
    this.active = true
    this.nameEl.textContent  = name
    this.root.style.display  = 'flex'
    this.setHP(maxHealth, maxHealth)
    this.setPhase(0)
  }

  hide(): void {
    this.active = false
    this.root.style.transition = 'opacity 0.8s'
    this.root.style.opacity    = '0'
    setTimeout(() => { this.root.style.display = 'none'; this.root.style.opacity = '1' }, 850)
  }

  private setHP(hp: number, maxHp: number): void {
    const pct = Math.max(0, hp / maxHp) * 100
    this.barFill.style.width = `${pct}%`
    // Colour: green → yellow → red as HP drops
    const color = pct > 60 ? '#e53935' : pct > 30 ? '#ff6d00' : '#b71c1c'
    this.barFill.style.background = color
  }

  private setPhase(phase: number): void {
    const labels = ['', 'PHASE II', 'PHASE III — BERSERK']
    this.phaseEl.textContent = labels[phase] ?? ''
    if (phase >= 2) {
      this.root.classList.add('bhb-rage')
    }
  }

  private build(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:       'fixed',
      top:            '20px',
      left:           '50%',
      transform:      'translateX(-50%)',
      display:        'none',
      flexDirection:  'column',
      alignItems:     'center',
      gap:            '5px',
      zIndex:         '60',
      pointerEvents:  'none',
      animation:      'bhb-enter 0.35s ease-out',
    })
    document.body.appendChild(el)

    // Boss name
    const name = document.createElement('div')
    name.className = 'bhb-name'
    Object.assign(name.style, {
      color:         '#ff3030',
      fontSize:      '13px',
      fontFamily:    'monospace',
      fontWeight:    '700',
      letterSpacing: '0.2em',
      textShadow:    '0 0 12px #ff0000',
      textTransform: 'uppercase',
    })
    el.appendChild(name)

    // Bar track
    const track = document.createElement('div')
    Object.assign(track.style, {
      width:        '380px',
      height:       '8px',
      background:   '#1a0000',
      border:       '1px solid #440000',
      borderRadius: '2px',
      overflow:     'hidden',
    })
    const fill = document.createElement('div')
    fill.className = 'bhb-fill'
    Object.assign(fill.style, {
      height:           '100%',
      width:            '100%',
      background:       '#e53935',
      borderRadius:     '2px',
      transition:       'width 0.25s, background 0.4s',
    })
    track.appendChild(fill)
    el.appendChild(track)

    // Phase label
    const phase = document.createElement('div')
    phase.className = 'bhb-phase'
    Object.assign(phase.style, {
      color:         '#ff6d00',
      fontSize:      '9px',
      fontFamily:    'monospace',
      letterSpacing: '0.25em',
      fontWeight:    '700',
      minHeight:     '12px',
    })
    el.appendChild(phase)

    return el
  }
}
