import { bus } from '../core/EventBus'

// ── VictoryScreen ─────────────────────────────────────────────────────────────
// Full-screen overlay shown when all 5 missions are complete.
// Auto-dismisses after 7 s or on any key / click.

export class VictoryScreen {
  private overlay: HTMLElement
  private visible  = false
  private timer:   ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.overlay = this.build()
    bus.on('victoryAchieved', () => this.show())
  }

  private build(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:       'fixed',
      inset:          '0',
      display:        'none',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            '16px',
      background:     'rgba(0,0,0,0)',
      zIndex:         '170',
      fontFamily:     'monospace',
      pointerEvents:  'auto',
    })
    document.body.appendChild(el)

    // Big VICTORY text
    const title = document.createElement('div')
    title.textContent = 'VICTORY'
    Object.assign(title.style, {
      fontSize:        'clamp(64px, 12vw, 120px)',
      fontWeight:      '900',
      letterSpacing:   '0.12em',
      color:           '#ffd700',
      textShadow:      '0 0 40px #ffd700, 0 0 80px #ff8c00, 0 4px 0 #8b6400',
      animation:       'vic-pulse 1.2s ease-in-out infinite alternate',
      userSelect:      'none',
    })
    el.appendChild(title)

    // Subtitle
    const sub = document.createElement('div')
    sub.textContent = 'All missions complete.'
    Object.assign(sub.style, {
      fontSize:      '18px',
      color:         'rgba(255,255,255,0.85)',
      letterSpacing: '0.15em',
      textShadow:    '0 0 12px rgba(255,215,0,0.5)',
      userSelect:    'none',
    })
    el.appendChild(sub)

    // Weapon notice
    const notice = document.createElement('div')
    notice.textContent = '— The Flag of Victory has been added to your inventory —'
    Object.assign(notice.style, {
      fontSize:      '12px',
      color:         'rgba(255,215,0,0.6)',
      letterSpacing: '0.1em',
      marginTop:     '4px',
      userSelect:    'none',
    })
    el.appendChild(notice)

    // Dismiss hint
    const hint = document.createElement('div')
    hint.textContent = 'press any key to continue'
    Object.assign(hint.style, {
      fontSize:      '10px',
      color:         'rgba(255,255,255,0.28)',
      letterSpacing: '0.12em',
      marginTop:     '24px',
      userSelect:    'none',
    })
    el.appendChild(hint)

    // CSS keyframe for pulsing glow
    const style = document.createElement('style')
    style.textContent = `
      @keyframes vic-pulse {
        from { text-shadow: 0 0 40px #ffd700, 0 0 80px #ff8c00, 0 4px 0 #8b6400; }
        to   { text-shadow: 0 0 70px #ffd700, 0 0 130px #ff4500, 0 4px 0 #8b6400; }
      }
    `
    document.head.appendChild(style)

    // Dismiss on key or click
    const dismiss = (): void => { if (this.visible) this.hide() }
    document.addEventListener('keydown', dismiss)
    el.addEventListener('click',   dismiss)

    return el
  }

  show(): void {
    if (this.visible) return
    this.visible = true
    this.overlay.style.display = 'flex'
    // Trigger confetti loop for the duration
    for (let i = 0; i < 4; i++) {
      setTimeout(() => bus.emit('confettiFired', {}), i * 1400)
    }
    // Auto-dismiss
    this.timer = setTimeout(() => this.hide(), 7000)
  }

  hide(): void {
    if (!this.visible) return
    this.visible = false
    this.overlay.style.display = 'none'
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
  }

  isVisible(): boolean { return this.visible }
}
