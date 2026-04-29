import { bus } from '../core/EventBus'

const TYPE_SPEED = 0.032   // seconds per character
const AUTO_HIDE  = 5.0     // seconds after text finishes before slide-out

export class MissionBriefing {
  private panel:   HTMLElement
  private titleEl: HTMLElement
  private textEl:  HTMLElement

  private fullText  = ''
  private charIdx   = 0
  private typeTimer = 0
  private hideTimer = 0
  private active    = false

  constructor() {
    // Pulse dot animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes brief-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.65)} }
      @keyframes brief-scan  { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
    `
    document.head.appendChild(style)

    this.panel = document.createElement('div')
    Object.assign(this.panel.style, {
      position:   'fixed',
      right:      '-440px',
      top:        '18%',
      width:      '380px',
      background: 'rgba(2,8,4,0.93)',
      border:     '1px solid rgba(80,200,100,0.28)',
      borderLeft: '3px solid rgba(80,220,110,0.72)',
      fontFamily: 'monospace',
      padding:    '18px 22px 20px',
      transition: 'right 0.38s cubic-bezier(0.4,0,0.2,1)',
      zIndex:     '92',
      pointerEvents: 'none',
      overflow:   'hidden',
    })

    // Scanline overlay
    const scan = document.createElement('div')
    Object.assign(scan.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none',
      background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',
    })
    this.panel.appendChild(scan)

    // Header row: pulsing dot + label
    const header = document.createElement('div')
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px',
    })
    const dot = document.createElement('div')
    Object.assign(dot.style, {
      width: '7px', height: '7px', borderRadius: '50%', flexShrink: '0',
      background: '#3ddc60', boxShadow: '0 0 7px #3ddc60',
      animation: 'brief-pulse 1.1s ease-in-out infinite',
    })
    const headerTxt = document.createElement('div')
    Object.assign(headerTxt.style, {
      fontSize: '8px', letterSpacing: '.24em',
      color: 'rgba(90,220,110,0.65)', textTransform: 'uppercase',
    })
    headerTxt.textContent = 'SECURE CHANNEL  ·  GHOST COMMAND'
    header.appendChild(dot)
    header.appendChild(headerTxt)
    this.panel.appendChild(header)

    // Mission title
    this.titleEl = document.createElement('div')
    Object.assign(this.titleEl.style, {
      fontSize: '13px', fontWeight: 'bold', letterSpacing: '.12em',
      color: '#e8ffe8', marginBottom: '12px', textTransform: 'uppercase',
    })
    this.panel.appendChild(this.titleEl)

    // Divider
    const div = document.createElement('div')
    Object.assign(div.style, {
      height: '1px', background: 'rgba(80,200,100,0.2)', marginBottom: '12px',
    })
    this.panel.appendChild(div)

    // Briefing text
    this.textEl = document.createElement('div')
    Object.assign(this.textEl.style, {
      fontSize: '11px', color: 'rgba(190,230,195,0.88)',
      lineHeight: '1.7', letterSpacing: '.025em', minHeight: '52px',
    })
    this.panel.appendChild(this.textEl)

    // Footer
    const footer = document.createElement('div')
    Object.assign(footer.style, {
      marginTop: '16px', fontSize: '8px', letterSpacing: '.18em',
      color: 'rgba(80,200,100,0.42)', textTransform: 'uppercase',
    })
    footer.textContent = '— MISSION OBJECTIVES UPDATED —'
    this.panel.appendChild(footer)

    document.body.appendChild(this.panel)

    bus.on<{ title: string; description: string }>('missionStarted', (e) => {
      this.show(e.title, e.description)
    })
  }

  show(title: string, description: string): void {
    this.titleEl.textContent = `// ${title}`
    this.textEl.textContent  = ''
    this.fullText  = description
    this.charIdx   = 0
    this.typeTimer = 0
    this.hideTimer = 0
    this.active    = true
    this.panel.style.right = '24px'
  }

  update(dt: number): void {
    if (!this.active) return

    if (this.charIdx < this.fullText.length) {
      this.typeTimer += dt
      while (this.typeTimer >= TYPE_SPEED && this.charIdx < this.fullText.length) {
        this.typeTimer -= TYPE_SPEED
        this.charIdx++
        this.textEl.textContent = this.fullText.slice(0, this.charIdx)
      }
    } else {
      this.hideTimer += dt
      if (this.hideTimer >= AUTO_HIDE) {
        this.active = false
        this.panel.style.right = '-440px'
      }
    }
  }
}
