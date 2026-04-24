import { AIAgent } from './AIAgent'

export class AISystem {
  private agents: AIAgent[] = []

  spawn(): AIAgent {
    const agent = new AIAgent()
    this.agents.push(agent)
    return agent
  }

  update(dt: number): void {
    for (const agent of this.agents) {
      if (!agent.isDead()) agent.update(dt)
    }
    this.agents = this.agents.filter(a => !a.isDead())
  }
}
