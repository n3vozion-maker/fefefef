import type { MissionSystem } from '../missions/MissionSystem'
import type { Mission }       from '../missions/Mission'
import type { MissionData }   from '../missions/Mission'

export class MissionSelectMenu {
  private overlay:  HTMLElement
  private list:     HTMLElement
  private _open     = false

  constructor(
    private missionSys: MissionSystem,
    private missionDefs: MissionData[],
  ) {
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(3px)',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff', zIndex: '80',
    })

    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: 'rgba(8,10,8,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '4px', padding: '36px 48px', minWidth: '480px', maxWidth: '600px',
      display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto',
    })

    const heading = document.createElement('div')
    Object.assign(heading.style, { fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.18em', color: '#aaa', marginBottom: '4px' })
    heading.textContent = 'MISSION SELECT'

    this.list = document.createElement('div')
    this.list.style.display = 'flex'
    this.list.style.flexDirection = 'column'
    this.list.style.gap = '10px'

    const closeBtn = document.createElement('div')
    Object.assign(closeBtn.style, { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', textAlign: 'center', cursor: 'pointer' })
    closeBtn.textContent = 'Press  M  to close'
    closeBtn.addEventListener('click', () => this.hide())

    panel.appendChild(heading)
    panel.appendChild(this.list)
    panel.appendChild(closeBtn)
    this.overlay.appendChild(panel)
    document.body.appendChild(this.overlay)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this._open ? this.hide() : this.show()
    })
  }

  private show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    this.rebuild()
  }

  private hide(): void {
    this._open = false
    this.overlay.style.display = 'none'
  }

  private rebuild(): void {
    this.list.innerHTML = ''
    const active = this.missionSys.getActive()

    for (const def of this.missionDefs) {
      const card = this.makeCard(def, active)
      this.list.appendChild(card)
    }
  }

  private makeCard(def: MissionData, active: Mission | null): HTMLElement {
    const isActive = active?.id === def.id

    const card = document.createElement('div')
    Object.assign(card.style, {
      border: `1px solid ${isActive ? '#4caf50' : 'rgba(255,255,255,0.12)'}`,
      borderRadius: '3px', padding: '16px 20px',
      background: isActive ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    })

    const titleRow = document.createElement('div')
    titleRow.style.display = 'flex'; titleRow.style.justifyContent = 'space-between'; titleRow.style.alignItems = 'center'

    const title = document.createElement('div')
    Object.assign(title.style, { fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.06em' })
    title.textContent = def.title

    const badge = document.createElement('div')
    Object.assign(badge.style, {
      fontSize: '10px', padding: '2px 8px', borderRadius: '2px',
      background: isActive ? '#4caf50' : 'rgba(255,255,255,0.1)',
      color: isActive ? '#fff' : '#aaa', letterSpacing: '0.1em',
    })
    badge.textContent = isActive ? 'ACTIVE' : 'AVAILABLE'

    titleRow.appendChild(title)
    titleRow.appendChild(badge)

    const desc = document.createElement('div')
    Object.assign(desc.style, { fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5' })
    desc.textContent = def.description

    card.appendChild(titleRow)
    card.appendChild(desc)

    if (isActive && active) {
      const objList = document.createElement('div')
      objList.style.display = 'flex'; objList.style.flexDirection = 'column'; objList.style.gap = '3px'
      for (const obj of active.objectives) {
        const row = document.createElement('div')
        Object.assign(row.style, {
          fontSize: '11px', color: obj.status === 'complete' ? '#4caf50' : 'rgba(255,255,255,0.6)',
          display: 'flex', gap: '8px',
        })
        row.textContent = (obj.status === 'complete' ? '✓ ' : '○ ') + obj.description
        objList.appendChild(row)
      }
      card.appendChild(objList)
    }

    if (!isActive) {
      const btn = document.createElement('button')
      Object.assign(btn.style, {
        background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
        fontFamily: 'monospace', fontSize: '11px', padding: '6px 14px',
        cursor: 'pointer', borderRadius: '2px', alignSelf: 'flex-start',
        letterSpacing: '0.08em', marginTop: '4px',
        transition: 'border-color 0.15s, color 0.15s',
      })
      btn.textContent = 'START MISSION'
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#4caf50'; btn.style.color = '#4caf50' })
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(255,255,255,0.2)'; btn.style.color = '#fff' })
      btn.addEventListener('click', () => {
        this.missionSys.start(def.id)
        this.hide()
      })
      card.appendChild(btn)
    }

    return card
  }

  isOpen(): boolean { return this._open }
}
