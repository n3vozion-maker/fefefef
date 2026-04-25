import * as THREE from 'three'
import { AIAgent }        from './AIAgent'
import { SquadManager }   from './SquadManager'
import { bus }            from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'

// Simple enemy soldier mesh (capsule approximation)
function makeAgentMesh(): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 6)
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5c3a, roughness: 0.8 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  return mesh
}

interface SpawnGroup {
  cx:    number
  cz:    number
  count: number
  squad: boolean
}

// Predefined enemy spawn groups (world coordinates of group centres)
const SPAWN_GROUPS: SpawnGroup[] = [
  { cx:  580, cz: -380, count: 4, squad: true  },
  { cx: -680, cz:  820, count: 4, squad: true  },
  { cx:  210, cz:-1180, count: 3, squad: false },
  { cx: 1090, cz:  120, count: 3, squad: false },
  { cx: -890, cz: -180, count: 3, squad: false },
  { cx: -290, cz:  520, count: 2, squad: false },
  { cx:  710, cz: -680, count: 2, squad: false },
  { cx:  410, cz:  310, count: 2, squad: false },
  { cx: -490, cz: -780, count: 3, squad: true  },
  { cx:  910, cz:  580, count: 2, squad: false },
]

const SPAWN_SCATTER = 14   // m — random offset around group centre

export class AISystem {
  private agents:  AIAgent[]       = []
  private squads:  SquadManager[]  = []
  private scene:   THREE.Scene
  private physics: PhysicsWorld

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene   = scene
    this.physics = physics
    this.spawnAll()

    bus.on<string>('agentDied', (id) => this.removeAgent(id))
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // Only update agents within 80m of player for performance
    const UPDATE_RADIUS_SQ = 80 * 80
    for (const agent of this.agents) {
      if (agent.isDead()) continue
      const dx = agent.body.position.x - playerPos.x
      const dz = agent.body.position.z - playerPos.z
      if (dx * dx + dz * dz > UPDATE_RADIUS_SQ) continue
      agent.update(dt, playerPos)
    }

    for (const squad of this.squads) squad.update(dt)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private spawnAll(): void {
    for (const grp of SPAWN_GROUPS) {
      const squadAgents: AIAgent[] = []

      for (let i = 0; i < grp.count; i++) {
        const x = grp.cx + (Math.random() - 0.5) * SPAWN_SCATTER * 2
        const z = grp.cz + (Math.random() - 0.5) * SPAWN_SCATTER * 2

        const agent = new AIAgent(x, z, this.physics)
        const mesh  = makeAgentMesh()
        mesh.position.set(x, 1, z)
        this.scene.add(mesh)
        agent.mesh = mesh

        this.agents.push(agent)
        if (grp.squad) squadAgents.push(agent)
      }

      if (grp.squad && squadAgents.length >= 2) {
        const squad = new SquadManager()
        squadAgents.forEach(a => squad.addAgent(a))
        this.squads.push(squad)
      }
    }
  }

  private removeAgent(id: string): void {
    const agent = this.agents.find(a => a.id === id)
    if (!agent) return
    setTimeout(() => {
      if (agent.mesh) this.scene.remove(agent.mesh)
    }, 3_000)   // leave corpse for 3s
  }
}
