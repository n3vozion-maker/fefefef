import * as THREE from 'three'
import { AIAgent }        from './AIAgent'
import { SquadManager }   from './SquadManager'
import { bus }            from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { EnemySniper }   from './enemies/EnemySniper'
import { EnemyRobot }    from './enemies/EnemyRobot'
import { EnemyDrone }    from './enemies/EnemyDrone'
import { EnemyTank }     from './enemies/EnemyTank'

// Simple enemy soldier mesh (capsule approximation)
function makeAgentMesh(): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(0.3, 1.2, 4, 6)
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5c3a, roughness: 0.8 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  return mesh
}

const RESPAWN_TIME = 120   // seconds before a dead group respawns

interface SpawnGroup {
  cx:    number
  cz:    number
  count: number
  squad: boolean
  respawnTimer?: number   // countdown; undefined = alive
}

// Ammo types dropped by infantry
const INFANTRY_AMMO_DROPS: Array<'rifle' | 'pistol'> = ['rifle', 'pistol', 'rifle', 'pistol', 'rifle']

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

// Positions for special enemy types
const SNIPER_SPAWNS:   [number, number][] = [
  [ 650, -320], [-730,  860], [ 200,-1120], [1050,  180],
]
const ROBOT_SPAWNS:    [number, number][] = [
  [ 400,  280], [-800, -250], [ 740, -700], [-350,  550],
]
const DRONE_SPAWNS:    [number, number][] = [
  [ 620, -390], [-720,  810], [ 190,-1190], [-510, -800],
]
const TANK_SPAWNS:     [number, number][] = [
  [ 570, -420], [-690,  830],
]

export class AISystem {
  private agents:   AIAgent[]       = []
  private squads:   SquadManager[]  = []
  private snipers:  EnemySniper[]   = []
  private robots:   EnemyRobot[]    = []
  private drones:   EnemyDrone[]    = []
  private tanks:    EnemyTank[]     = []
  private scene:    THREE.Scene
  private physics:  PhysicsWorld
  private groups:   SpawnGroup[]    = []
  private endgame   = false

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene   = scene
    this.physics = physics
    this.spawnAll()
    this.spawnSpecialEnemies()

    bus.on<string>('agentDied', (id) => this.onAgentDied(id))
    bus.on('endgameStarted', () => { this.endgame = true })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const UPDATE_RADIUS_SQ = 80 * 80
    for (const agent of this.agents) {
      if (agent.isDead()) continue
      const dx = agent.body.position.x - playerPos.x
      const dz = agent.body.position.z - playerPos.z
      if (dx * dx + dz * dz > UPDATE_RADIUS_SQ) continue
      agent.update(dt, playerPos)
    }

    for (const squad of this.squads) squad.update(dt)

    for (const s of this.snipers) s.update(dt, playerPos)
    for (const r of this.robots)  r.update(dt, playerPos)
    for (const d of this.drones)  d.update(dt, playerPos)
    for (const t of this.tanks)   t.update(dt, playerPos)

    // Respawn in endgame
    if (this.endgame) this.tickRespawn(dt)
  }

  private tickRespawn(dt: number): void {
    for (const grp of this.groups) {
      if (grp.respawnTimer === undefined) continue
      grp.respawnTimer -= dt
      if (grp.respawnTimer <= 0) {
        grp.respawnTimer = undefined
        this.spawnGroup(grp)
      }
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private spawnAll(): void {
    for (const grp of SPAWN_GROUPS) {
      this.groups.push(grp)
      this.spawnGroup(grp)
    }

  }

  private spawnGroup(grp: SpawnGroup): void {
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

  private onAgentDied(id: string): void {
    const agent = this.agents.find(a => a.id === id)
    if (!agent) return

    // Drop ammo at death position
    const pos = agent.getPosition()
    const ammoType = INFANTRY_AMMO_DROPS[Math.floor(Math.random() * INFANTRY_AMMO_DROPS.length)] ?? 'rifle'
    bus.emit('enemyAmmoDrop', {
      position: pos,
      ammoType,
      amount: 15 + Math.floor(Math.random() * 20),
    })

    // Remove mesh after 3s
    setTimeout(() => {
      if (agent.mesh) this.scene.remove(agent.mesh)
    }, 3000)

    // Check if this group is fully dead → start respawn
    this.checkGroupRespawn()
  }

  private checkGroupRespawn(): void {
    for (const grp of this.groups) {
      if (grp.respawnTimer !== undefined) continue
      // Find agents that belong to this group (by proximity to centre)
      const groupAgents = this.agents.filter(a => {
        const dx = a.body.position.x - grp.cx
        const dz = a.body.position.z - grp.cz
        return Math.sqrt(dx * dx + dz * dz) < SPAWN_SCATTER * 3
      })
      const allDead = groupAgents.length > 0 && groupAgents.every(a => a.isDead())
      if (allDead && this.endgame) {
        grp.respawnTimer = RESPAWN_TIME
      }
    }
  }

  /** Exposes all infantry agents (for difficulty HP scaling at game start) */
  getAgents(): AIAgent[] { return this.agents }

  /** All special enemies as objects with a public `hp` field */
  getSpecialEnemies(): Array<{ hp: number; alive: boolean }> {
    return [...this.snipers, ...this.robots, ...this.drones, ...this.tanks]
  }

  /** Returns world positions of all living enemies (for minimap) */
  getAgentPositions(): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    for (const a of this.agents) {
      if (a.isDead()) continue
      const p = a.body.position
      out.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    for (const s of this.snipers) {
      if (!s.alive) continue
      const p = s.body.position
      out.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    for (const r of this.robots) {
      if (!r.alive) continue
      const p = r.body.position
      out.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    for (const d of this.drones) {
      if (!d.alive) continue
      out.push(d.getPosition())
    }
    for (const t of this.tanks) {
      if (!t.alive) continue
      const p = t.body.position
      out.push(new THREE.Vector3(p.x, p.y, p.z))
    }
    return out
  }

  private spawnSpecialEnemies(): void {
    for (const [x, z] of SNIPER_SPAWNS) {
      this.snipers.push(new EnemySniper(x, z, this.physics, this.scene))
    }
    for (const [x, z] of ROBOT_SPAWNS) {
      this.robots.push(new EnemyRobot(x, z, this.physics, this.scene))
    }
    for (const [x, z] of DRONE_SPAWNS) {
      this.drones.push(new EnemyDrone(x, 8, z, this.scene))
    }
    for (const [x, z] of TANK_SPAWNS) {
      this.tanks.push(new EnemyTank(x, z, this.physics, this.scene))
    }
  }
}
