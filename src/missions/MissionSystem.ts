import { Mission, type MissionData } from './Mission'
import { bus }                        from '../core/EventBus'

export class MissionSystem {
  private missions = new Map<string, Mission>()
  private active:  Mission | null = null

  constructor() {
    bus.on<{ agentId: string }>('agentDied',  (e) => this.onAgentDied(e.agentId))
    bus.on<string>('bossDied',                (id) => this.onBossDied(id))
    bus.on<{ id: string }>('poiDiscovered',   (e)  => this.onPOI(e.id))
  }

  load(data: MissionData): void {
    this.missions.set(data.id, new Mission(data))
  }

  start(id: string): void {
    const m = this.missions.get(id)
    if (!m) throw new Error(`Mission not found: ${id}`)
    m.active = true
    this.active = m
    bus.emit('missionStarted', m)
    this.showNotification(`MISSION: ${m.title}`, '#ffa726')
  }

  completeObjective(objId: string): void {
    if (!this.active) return
    this.active.completeObjective(objId)
    bus.emit('objectiveCompleted', objId)
    this.showNotification('✓ Objective complete', '#66bb6a')

    if (this.active.complete) {
      bus.emit('missionComplete',   this.active)
      bus.emit('missionCompleted',  { missionId: this.active.id })   // for UnlockSystem
      this.showNotification(`MISSION COMPLETE: ${this.active.title}`, '#66bb6a')
      this.active = null
    }
  }

  getActive(): Mission | null { return this.active }

  // ── Internal triggers ───────────────────────────────────────────────────────

  private onAgentDied(id: string): void {
    if (!this.active) return
    for (const obj of this.active.objectives) {
      if (obj.status === 'active' && obj.id.includes(id)) {
        this.completeObjective(obj.id)
      }
    }
  }

  private onBossDied(id: string): void {
    if (!this.active) return
    for (const obj of this.active.objectives) {
      if (obj.status === 'active' && obj.id.includes(id)) {
        this.completeObjective(obj.id)
      }
    }
  }

  private onPOI(poiId: string): void {
    if (!this.active) return
    for (const obj of this.active.objectives) {
      if (obj.status === 'active' && obj.id.includes(poiId)) {
        this.completeObjective(obj.id)
      }
    }
  }

  private showNotification(msg: string, color: string): void {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', top: '22%', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)', color, fontFamily: 'monospace',
      fontSize: '14px', padding: '10px 28px', borderLeft: `3px solid ${color}`,
      letterSpacing: '0.08em', pointerEvents: 'none', opacity: '1',
      transition: 'opacity 1.2s', whiteSpace: 'nowrap',
    })
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => { el.style.opacity = '0' }, 2800)
    setTimeout(() => el.remove(), 4200)
  }
}
