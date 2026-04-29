import type { Objective } from './Objective'

export interface MissionData {
  id: string
  title: string
  description: string
  objectives: Objective[]
}

export class Mission {
  readonly id: string
  readonly title: string
  readonly description: string
  objectives: Objective[]
  active = false
  complete = false

  constructor(data: MissionData) {
    this.id          = data.id
    this.title       = data.title
    this.description = data.description
    this.objectives  = data.objectives.map(o => ({ ...o }))
  }

  completeObjective(id: string): void {
    const obj = this.objectives.find(o => o.id === id)
    if (obj) obj.status = 'complete'
    this.checkCompletion()
  }

  private checkCompletion(): void {
    const required = this.objectives.filter(o => !o.optional)
    if (required.every(o => o.status === 'complete')) this.complete = true
  }
}
