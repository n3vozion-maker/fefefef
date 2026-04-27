import * as THREE from 'three'
import { bus }    from '../core/EventBus'
import type { UnlockSystem } from '../persistence/UnlockSystem'

// ── Side quest definitions ────────────────────────────────────────────────────

interface SideQuest {
  id:          string
  title:       string
  description: string
  targetPos:   THREE.Vector3
  radius:      number       // metres — reach radius
  type:        'reach' | 'survive'
  completed:   boolean
  active:      boolean
}

const SIDE_QUESTS: Omit<SideQuest, 'completed' | 'active'>[] = [
  { id: 'sq_1', title: 'Signal Tower',     description: 'Reach the abandoned signal tower.',         targetPos: new THREE.Vector3( 320,  0,  680), radius: 25, type: 'reach'   },
  { id: 'sq_2', title: 'Fuel Depot',       description: 'Secure the fuel depot to the east.',        targetPos: new THREE.Vector3(1200,  0,  -80), radius: 30, type: 'reach'   },
  { id: 'sq_3', title: 'Mountain Pass',    description: 'Cross the high mountain pass.',              targetPos: new THREE.Vector3(-100,  0, -900), radius: 30, type: 'reach'   },
  { id: 'sq_4', title: 'Sunken Bridge',    description: 'Investigate the collapsed bridge.',          targetPos: new THREE.Vector3( 750,  0,  420), radius: 25, type: 'reach'   },
  { id: 'sq_5', title: 'The Graveyard',    description: 'Clear the enemy graveyard outpost.',         targetPos: new THREE.Vector3(-600,  0, -550), radius: 30, type: 'survive' },
  { id: 'sq_6', title: 'Radio Station',    description: 'Reach the old radio station.',              targetPos: new THREE.Vector3( 200,  0,  980), radius: 25, type: 'reach'   },
  { id: 'sq_7', title: 'Refinery Ruins',   description: 'Explore the refinery ruins.',               targetPos: new THREE.Vector3(-980,  0,  380), radius: 30, type: 'reach'   },
  { id: 'sq_8', title: 'Last Stronghold',  description: 'Storm the last enemy stronghold.',          targetPos: new THREE.Vector3( 880,  0, -820), radius: 35, type: 'survive' },
]

const GHOST_QUEST_COUNT = 5   // all GHOST SUPPLY side quests

// ── EndgameSystem ─────────────────────────────────────────────────────────────

export class EndgameSystem {
  private active               = false
  private quests:              SideQuest[] = []
  private activeQuest:         SideQuest | null = null
  private overlay:             HTMLElement
  private questPanel:          HTMLElement
  private completedMissions    = new Set<string>()
  private completedGhostQuests = 0

  constructor(_unlocks: UnlockSystem) {
    this.overlay    = this.buildOverlay()
    this.questPanel = this.buildQuestPanel()

    bus.on<{ missionId: string }>('missionCompleted', ({ missionId }) => {
      this.completedMissions.add(missionId)
      this.checkEndgame()
    })

    // Each GHOST SUPPLY quest completion nudges the counter
    bus.on<string>('sqCompleted', () => {
      this.completedGhostQuests++
      this.checkEndgame()
    })

    this.quests = SIDE_QUESTS.map(q => ({ ...q, completed: false, active: false }))
  }

  private checkEndgame(): void {
    if (this.active) return
    const allMissions = this.completedMissions.size >= 5
    const allGhost    = this.completedGhostQuests >= GHOST_QUEST_COUNT
    if (allMissions && allGhost) this.triggerEndgame()
  }

  private triggerEndgame(): void {
    this.active = true
    this.showNotification('SANDBOX MODE UNLOCKED — The world is yours', '#ffd700', 6000)
    setTimeout(() => {
      this.overlay.style.display = 'flex'
      this.buildQuestList()
    }, 4000)
    bus.emit('endgameStarted', {})
  }

  // ── Update — proximity checks ─────────────────────────────────────────────

  update(_dt: number, playerPos: THREE.Vector3): void {
    if (!this.active || !this.activeQuest) return
    const q    = this.activeQuest
    const dist = playerPos.distanceTo(q.targetPos)

    if (dist < q.radius && !q.completed) {
      q.completed   = true
      q.active      = false
      this.activeQuest = null
      this.completedGhostQuests++
      this.showNotification(`✓ ${q.title} — complete!`, '#66bb6a', 3500)
      bus.emit('sideQuestCompleted', { id: q.id })
      this.buildQuestList()
    }
  }

  // ── Start a quest from the panel ──────────────────────────────────────────

  private startQuest(q: SideQuest): void {
    if (q.completed) return
    if (this.activeQuest) this.activeQuest.active = false
    q.active        = true
    this.activeQuest = q
    this.overlay.style.display = 'none'
    this.showNotification(`→ ${q.title}: ${q.description}`, '#ffa726', 3500)
    bus.emit('sideQuestStarted', { id: q.id, targetPos: q.targetPos })
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  private buildOverlay(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff', zIndex: '82',
      flexDirection: 'column', gap: '0',
    })
    document.body.appendChild(el)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') el.style.display = el.style.display === 'none' ? 'flex' : 'none'
    })

    return el
  }

  private buildQuestPanel(): HTMLElement {
    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: 'rgba(8,10,8,0.95)', border: '1px solid rgba(255,215,0,0.2)',
      borderRadius: '4px', padding: '32px 44px', minWidth: '520px', maxWidth: '620px',
      maxHeight: '80vh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '12px',
    })

    const heading = document.createElement('div')
    Object.assign(heading.style, {
      fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.2em',
      color: '#ffd700', marginBottom: '6px',
    })
    heading.textContent = 'SIDE QUESTS'
    panel.appendChild(heading)

    const sub = document.createElement('div')
    Object.assign(sub.style, {
      fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em',
      marginBottom: '12px',
    })
    sub.textContent = 'Press  J  to toggle  |  Click a quest to start tracking'
    panel.appendChild(sub)

    this.overlay.appendChild(panel)
    return panel
  }

  private buildQuestList(): void {
    // Remove old quest cards
    const cards = this.questPanel.querySelectorAll('.sq-card')
    cards.forEach(c => c.remove())

    const done  = this.quests.filter(q => q.completed).length
    const total = this.quests.length

    const progress = document.createElement('div')
    Object.assign(progress.style, {
      fontSize: '11px', color: 'rgba(255,255,255,0.45)',
      marginBottom: '8px',
    })
    progress.textContent = `${done} / ${total} completed`
    progress.className   = 'sq-card'
    this.questPanel.appendChild(progress)

    for (const q of this.quests) {
      const card = document.createElement('div')
      card.className = 'sq-card'
      const isActive = this.activeQuest?.id === q.id
      Object.assign(card.style, {
        border: `1px solid ${q.completed ? '#4caf5055' : isActive ? '#ffa726' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '3px', padding: '12px 16px',
        background: q.completed ? 'rgba(76,175,80,0.06)' : isActive ? 'rgba(255,167,38,0.08)' : 'rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column', gap: '4px',
        cursor: q.completed ? 'default' : 'pointer',
        opacity: q.completed ? '0.55' : '1',
        transition: 'border-color 0.15s',
      })

      const titleRow = document.createElement('div')
      titleRow.style.display = 'flex'; titleRow.style.justifyContent = 'space-between'

      const titleEl = document.createElement('div')
      Object.assign(titleEl.style, { fontSize: '13px', fontWeight: 'bold' })
      titleEl.textContent = (q.completed ? '✓  ' : isActive ? '→  ' : '○  ') + q.title

      const badge = document.createElement('div')
      Object.assign(badge.style, {
        fontSize: '9px', padding: '2px 6px', borderRadius: '2px',
        background: q.type === 'reach' ? 'rgba(79,195,247,0.2)' : 'rgba(239,83,80,0.2)',
        color: q.type === 'reach' ? '#4fc3f7' : '#ef5350',
        letterSpacing: '0.08em', alignSelf: 'center',
      })
      badge.textContent = q.type.toUpperCase()

      titleRow.appendChild(titleEl); titleRow.appendChild(badge)
      card.appendChild(titleRow)

      const desc = document.createElement('div')
      Object.assign(desc.style, { fontSize: '11px', color: 'rgba(255,255,255,0.5)' })
      desc.textContent = q.description
      card.appendChild(desc)

      if (!q.completed) {
        card.addEventListener('click', () => this.startQuest(q))
        card.addEventListener('mouseenter', () => { if (!isActive) card.style.borderColor = '#ffa72699' })
        card.addEventListener('mouseleave', () => { if (!isActive) card.style.borderColor = 'rgba(255,255,255,0.1)' })
      }

      this.questPanel.appendChild(card)
    }
  }

  private showNotification(msg: string, color: string, duration = 3000): void {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.75)', color, fontFamily: 'monospace',
      fontSize: '14px', padding: '10px 28px', borderLeft: `3px solid ${color}`,
      letterSpacing: '0.08em', pointerEvents: 'none', opacity: '1',
      transition: 'opacity 1.2s', whiteSpace: 'nowrap', zIndex: '200',
    })
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => { el.style.opacity = '0' }, duration - 1200)
    setTimeout(() => el.remove(), duration)
  }

  isActive(): boolean { return this.active }
}
