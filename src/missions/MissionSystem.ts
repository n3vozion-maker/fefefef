import { Mission, type MissionData } from './Mission'
import { bus } from '../core/EventBus'

export class MissionSystem {
  private missions = new Map<string, Mission>()
  private active: Mission | null = null

  load(data: MissionData): void {
    this.missions.set(data.id, new Mission(data))
  }

  start(id: string): void {
    const mission = this.missions.get(id)
    if (!mission) throw new Error(`Mission not found: ${id}`)
    this.active = mission
    mission.active = true
    bus.emit('missionStarted', mission)
  }

  completeObjective(objectiveId: string): void {
    if (!this.active) return
    this.active.completeObjective(objectiveId)
    if (this.active.complete) {
      bus.emit('missionComplete', this.active)
      this.active = null
    }
  }
}
