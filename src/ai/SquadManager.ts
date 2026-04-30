import type { AIAgent } from './AIAgent'

export type SquadRole = 'suppressor' | 'flanker' | 'medic' | 'retreat'

export class SquadManager {
  private agents: AIAgent[] = []
  private roles   = new Map<string, SquadRole>()
  private roleTimer = 0

  addAgent(agent: AIAgent): void {
    this.agents.push(agent)
    this.roles.set(agent.id, 'suppressor')
  }

  update(dt: number): void {
    const alive = this.agents.filter(a => !a.isDead())
    if (alive.length === 0) return

    this.roleTimer -= dt
    if (this.roleTimer > 0) return
    this.roleTimer = 4 + Math.random() * 3   // reassign roles every 4-7s

    const totalHp  = alive.reduce((s, a) => s + a.health, 0)
    const maxHp    = alive.length * 100

    if (totalHp / maxHp < 0.3) {
      alive.forEach(a => { this.roles.set(a.id, 'retreat'); a.squadRole = 'retreat' })
      return
    }

    // Rotate roles: first agent flanks, rest suppress
    alive.forEach((a, i) => {
      const role: SquadRole = i === 0 ? 'flanker' : 'suppressor'
      this.roles.set(a.id, role)
      a.squadRole = role
    })
  }

  getRole(agentId: string): SquadRole { return this.roles.get(agentId) ?? 'suppressor' }
}
