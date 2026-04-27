import { bus } from '../core/EventBus'

// ── SideQuestPanel ────────────────────────────────────────────────────────────
// Compact panel (top-right) showing the active side quest title + objective.

export class SideQuestPanel {
  private root:    HTMLElement
  private title:   HTMLElement
  private objEl:   HTMLElement
  private visible  = false

  constructor() {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes sqp-in { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
      .sqp-root {
        position:fixed; top:72px; right:22px;
        background:rgba(0,0,0,0.65); border-right:2px solid #ffcc00;
        padding:8px 14px 8px 12px; min-width:200px; max-width:280px;
        font-family:monospace; pointer-events:none; user-select:none;
        animation:sqp-in 0.4s ease-out; z-index:25;
      }
      .sqp-header {
        font-size:8px; color:rgba(255,200,60,0.6); letter-spacing:.25em;
        text-transform:uppercase; margin-bottom:4px;
      }
      .sqp-title {
        font-size:12px; font-weight:700; color:#ffdd55;
        letter-spacing:.1em; text-transform:uppercase; margin-bottom:6px;
        text-shadow:0 0 10px #ffaa0088;
      }
      .sqp-obj {
        font-size:10px; color:rgba(255,255,255,0.7); letter-spacing:.05em;
        line-height:1.4;
      }
    `
    document.head.appendChild(style)

    this.root = document.createElement('div')
    this.root.className = 'sqp-root'
    this.root.style.display = 'none'

    const header = document.createElement('div')
    header.className = 'sqp-header'
    header.textContent = '— SIDE QUEST —'

    this.title = document.createElement('div')
    this.title.className = 'sqp-title'

    this.objEl = document.createElement('div')
    this.objEl.className = 'sqp-obj'

    this.root.appendChild(header)
    this.root.appendChild(this.title)
    this.root.appendChild(this.objEl)
    document.body.appendChild(this.root)

    // Bus events
    bus.on<{ id: string; title: string; briefing: string }>('sqStarted', (e) => {
      this.show(e.title, '')
    })

    bus.on<string>('sqObjectiveUpdated', () => {
      // Content is updated externally via setObjective
    })

    bus.on<string>('sqCompleted', () => {
      this.hide()
    })
  }

  show(title: string, obj: string): void {
    this.visible       = true
    this.title.textContent = title
    this.objEl.textContent = obj
    this.root.style.display = 'block'
    // Re-trigger animation
    this.root.style.animation = 'none'
    requestAnimationFrame(() => { this.root.style.animation = 'sqp-in 0.4s ease-out' })
  }

  hide(): void {
    this.visible = false
    this.root.style.display = 'none'
  }

  /** Update the displayed objective text each frame from the quest system. */
  setObjective(text: string): void {
    if (!this.visible) return
    this.objEl.textContent = text
  }

  isVisible(): boolean { return this.visible }
}
