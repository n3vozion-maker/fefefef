import { bus } from '../core/EventBus'

// ── TitleScreen ───────────────────────────────────────────────────────────────
// Shown at startup. Postal × Ultrakill aesthetic: black, red, aggressive type.
// Dismissed on PLAY click → emits 'gameStarted' so main.ts can unlock input.

export class TitleScreen {
  private overlay: HTMLElement
  private _dismissed = false

  constructor() {
    this.overlay = this.build()
  }

  isDismissed(): boolean { return this._dismissed }

  private dismiss(): void {
    if (this._dismissed) return
    this._dismissed = true
    this.overlay.style.transition = 'opacity 0.45s'
    this.overlay.style.opacity    = '0'
    setTimeout(() => {
      this.overlay.style.display = 'none'
      bus.emit('gameStarted', {})
    }, 460)
  }

  private build(): HTMLElement {
    // Inject CSS animations
    const style = document.createElement('style')
    style.textContent = `
      @keyframes ts-flicker {
        0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.85} 94%{opacity:1} 97%{opacity:0.92} 98%{opacity:1}
      }
      @keyframes ts-scanline {
        0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)}
      }
      @keyframes ts-pulse-red {
        0%,100%{text-shadow:0 0 30px #ff0000,0 0 60px #8b0000,0 3px 0 #4a0000}
        50%{text-shadow:0 0 50px #ff2200,0 0 100px #cc0000,0 3px 0 #4a0000}
      }
      @keyframes ts-subtitle {
        0%{opacity:0;letter-spacing:0.5em} 100%{opacity:1;letter-spacing:0.18em}
      }
      @keyframes ts-btn-hover {
        0%,100%{box-shadow:0 0 0 rgba(255,0,0,0)} 50%{box-shadow:0 0 22px rgba(255,0,0,0.5)}
      }
      .ts-playbtn:hover{background:#cc0000 !important;letter-spacing:0.35em !important;}
    `
    document.head.appendChild(style)

    const el = document.createElement('div')
    Object.assign(el.style, {
      position:       'fixed',
      inset:          '0',
      background:     '#000',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         '999',
      fontFamily:     'monospace',
      userSelect:     'none',
      animation:      'ts-flicker 8s infinite',
      overflow:       'hidden',
    })
    document.body.appendChild(el)

    // Scanline overlay
    const scan = document.createElement('div')
    Object.assign(scan.style, {
      position:   'absolute',
      top:        '0',
      left:       '0',
      right:      '0',
      height:     '3px',
      background: 'rgba(255,255,255,0.04)',
      animation:  'ts-scanline 4s linear infinite',
      pointerEvents: 'none',
    })
    el.appendChild(scan)

    // Horizontal rule top
    const ruleTop = document.createElement('div')
    Object.assign(ruleTop.style, {
      width:        '520px',
      height:       '1px',
      background:   'linear-gradient(90deg, transparent, #ff0000, transparent)',
      marginBottom: '32px',
    })
    el.appendChild(ruleTop)

    // Pre-title label
    const pre = document.createElement('div')
    pre.textContent = '// CLASSIFIED //'
    Object.assign(pre.style, {
      fontSize:      '11px',
      color:         '#ff000088',
      letterSpacing: '0.4em',
      marginBottom:  '14px',
    })
    el.appendChild(pre)

    // Main title
    const title = document.createElement('div')
    title.textContent = 'IRON\u00a0ZERO'   // \u00a0 = non-breaking space
    Object.assign(title.style, {
      fontSize:      'clamp(72px, 14vw, 140px)',
      fontWeight:    '900',
      color:         '#ffffff',
      letterSpacing: '0.08em',
      lineHeight:    '1',
      animation:     'ts-pulse-red 2.8s ease-in-out infinite',
      marginBottom:  '10px',
    })
    el.appendChild(title)

    // Subtitle
    const sub = document.createElement('div')
    sub.textContent = 'NO MERCY. NO RETREAT. NO SIGNAL.'
    Object.assign(sub.style, {
      fontSize:        '11px',
      color:           'rgba(255,40,40,0.75)',
      letterSpacing:   '0.18em',
      animation:       'ts-subtitle 1.8s ease-out forwards',
      opacity:         '0',
      marginBottom:    '64px',
    })
    el.appendChild(sub)

    // Horizontal rule bottom
    const ruleBot = document.createElement('div')
    Object.assign(ruleBot.style, {
      width:         '520px',
      height:        '1px',
      background:    'linear-gradient(90deg, transparent, #ff0000, transparent)',
      marginBottom:  '48px',
    })
    el.appendChild(ruleBot)

    // PLAY button
    const btn = document.createElement('button')
    btn.textContent = 'ENGAGE'
    btn.className   = 'ts-playbtn'
    Object.assign(btn.style, {
      background:    '#8b0000',
      color:         '#fff',
      border:        '1px solid #ff0000',
      padding:       '14px 56px',
      fontSize:      '16px',
      fontFamily:    'monospace',
      fontWeight:    '700',
      letterSpacing: '0.28em',
      cursor:        'pointer',
      outline:       'none',
      transition:    'background 0.12s, letter-spacing 0.12s',
      animation:     'ts-btn-hover 2.2s ease-in-out infinite',
    })
    btn.addEventListener('click', () => this.dismiss())
    el.appendChild(btn)

    // Controls hint
    const hint = document.createElement('div')
    hint.textContent = 'WASD · MOUSE · ESC pause'
    Object.assign(hint.style, {
      position:      'absolute',
      bottom:        '22px',
      fontSize:      '9px',
      color:         'rgba(255,255,255,0.18)',
      letterSpacing: '0.15em',
    })
    el.appendChild(hint)

    // Version tag
    const ver = document.createElement('div')
    ver.textContent = 'v0.1.0'
    Object.assign(ver.style, {
      position:   'absolute',
      bottom:     '22px',
      right:      '22px',
      fontSize:   '9px',
      color:      'rgba(255,0,0,0.3)',
      letterSpacing: '0.1em',
    })
    el.appendChild(ver)

    return el
  }
}
