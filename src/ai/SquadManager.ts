import type { AIAgent } from './AIAgent'

export type SquadRole = 'suppressor' | 'flanker' | 'medic' | 'retreat'

export class SquadManager {
  private agents: AIAgent[] = []

  addAgent(agent: AIAgent): void {
    this.agents.push(agent)
  }

  update(_dt: number): void {
    const totalHealth = this.agents.reduce((s, a) => s + a.health, 0)
    const maxHealth = this.agents.length * 100
    if (totalHealth / maxHealth < 0.3) {
      // trigger retreat
    }
  }
}
