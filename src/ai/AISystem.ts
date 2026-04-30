import * as THREE from 'three'
import { AIAgent, type EnemyType } from './AIAgent'
import type { WeaponFiredPayload } from '../weapons/WeaponBase'
import { SquadManager }   from './SquadManager'
import { bus }            from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { EnemySniper }   from './enemies/EnemySniper'
import { EnemyRobot }    from './enemies/EnemyRobot'
import { EnemyDrone }    from './enemies/EnemyDrone'
import { EnemyTank }     from './enemies/EnemyTank'

// Shared base materials
const _matGun = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.55, metalness: 0.82 })

// Per-type material sets
const MATS: Record<EnemyType, { uniform: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; helmet: THREE.MeshStandardMaterial }> = {
  standard: {
    uniform: new THREE.MeshStandardMaterial({ color: 0x3d4a2e, roughness: 0.85, metalness: 0.05 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x1e2612, roughness: 0.9,  metalness: 0.08 }),
    helmet:  new THREE.MeshStandardMaterial({ color: 0x2a3520, roughness: 0.75, metalness: 0.22 }),
  },
  scout: {
    uniform: new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.80, metalness: 0.10 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.9,  metalness: 0.12 }),
    helmet:  new THREE.MeshStandardMaterial({ color: 0x303038, roughness: 0.70, metalness: 0.28 }),
  },
  gunner: {
    uniform: new THREE.MeshStandardMaterial({ color: 0x2a1e10, roughness: 0.90, metalness: 0.08 }),
    dark:    new THREE.MeshStandardMaterial({ color: 0x100c06, roughness: 0.95, metalness: 0.15 }),
    helmet:  new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.80, metalness: 0.35 }),
  },
}

function makeAgentMesh(type: EnemyType = 'standard'): THREE.Group {
  const { uniform: _matUniform, dark: _matDark, helmet: _matHelmet } = MATS[type]
  const g = new THREE.Group()

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    if (rx) m.rotation.x = rx
    if (ry) m.rotation.y = ry
    if (rz) m.rotation.z = rz
    m.castShadow = true
    g.add(m)
    return m
  }

  // Head + helmet
  add(new THREE.SphereGeometry(0.155, 8, 6),                               _matUniform, 0, 1.57, 0)
  add(new THREE.CylinderGeometry(0.195, 0.185, 0.06, 10),                  _matHelmet,  0, 1.64, 0)
  add(new THREE.SphereGeometry(0.18, 8, 5, 0, Math.PI*2, 0, Math.PI*0.6), _matHelmet,  0, 1.62, 0)

  // Torso
  add(new THREE.BoxGeometry(0.44, 0.50, 0.25), _matUniform, 0, 1.12, 0)
  // Tactical vest
  add(new THREE.BoxGeometry(0.40, 0.36, 0.09), _matDark,    0, 1.14, 0.10)
  // Vest pouches
  add(new THREE.BoxGeometry(0.10, 0.11, 0.08), _matDark, -0.12, 1.08, 0.14)
  add(new THREE.BoxGeometry(0.10, 0.11, 0.08), _matDark,  0.12, 1.08, 0.14)

  // Arms: left upper, left forearm
  add(new THREE.CylinderGeometry(0.072, 0.066, 0.26, 6), _matUniform, -0.27, 1.11, 0,    0, 0,  0.22)
  add(new THREE.CylinderGeometry(0.060, 0.054, 0.22, 6), _matUniform, -0.31, 0.88, 0)
  // Arms: right upper (angled forward to hold weapon), right forearm
  add(new THREE.CylinderGeometry(0.072, 0.066, 0.26, 6), _matUniform,  0.27, 1.11,-0.04, 0, 0, -0.22)
  add(new THREE.CylinderGeometry(0.060, 0.054, 0.22, 6), _matUniform,  0.29, 0.89,-0.08,-0.28)

  // Legs: left thigh, shin, boot
  add(new THREE.CylinderGeometry(0.095, 0.085, 0.38, 6), _matUniform, -0.135, 0.63, 0)
  add(new THREE.CylinderGeometry(0.078, 0.068, 0.34, 6), _matUniform, -0.135, 0.26, 0)
  add(new THREE.BoxGeometry(0.13, 0.09, 0.21),            _matDark,   -0.135, 0.05, 0.04)
  // Legs: right thigh, shin, boot
  add(new THREE.CylinderGeometry(0.095, 0.085, 0.38, 6), _matUniform,  0.135, 0.63, 0)
  add(new THREE.CylinderGeometry(0.078, 0.068, 0.34, 6), _matUniform,  0.135, 0.26, 0)
  add(new THREE.BoxGeometry(0.13, 0.09, 0.21),            _matDark,    0.135, 0.05, 0.04)

  // Assault rifle prop (held right side)
  add(new THREE.BoxGeometry(0.052, 0.058, 0.34), _matGun, 0.21, 1.01, -0.11)
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.20, 6), _matGun, 0.21, 1.03, -0.29, Math.PI/2)
  add(new THREE.BoxGeometry(0.038, 0.046, 0.11), _matDark, 0.21, 0.98,  0.08)

  // Hit-flash overlay — unique material per group so opacity is per-instance
  const flashMat  = new THREE.MeshBasicMaterial({
    color: 0xff1a1a, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
  })
  const flashMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.15, 4, 8), flashMat)
  flashMesh.position.y = 0.85
  g.userData['flashMesh'] = flashMesh
  g.add(flashMesh)

  return g
}

const RESPAWN_TIME = 120   // seconds before a dead group respawns

function pickType(): EnemyType {
  const r = Math.random()
  if (r < 0.25) return 'scout'
  if (r < 0.45) return 'gunner'
  return 'standard'
}

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

    bus.on<boolean>('nvChanged', (active) => this.setNVGlow(active))

    // Alert nearby agents when player fires — suppressor limits radius to 10m
    bus.on<WeaponFiredPayload>('weaponFired', (p) => {
      const r = p.suppressed ? 10 : 44
      const r2 = r * r
      for (const agent of this.agents) {
        if (agent.isDead() || agent.alertState === 'combat') continue
        const dx = agent.body.position.x - p.origin.x
        const dz = agent.body.position.z - p.origin.z
        if (dx * dx + dz * dz < r2) agent.alertState = 'combat'
      }
    })
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
      const x    = grp.cx + (Math.random() - 0.5) * SPAWN_SCATTER * 2
      const z    = grp.cz + (Math.random() - 0.5) * SPAWN_SCATTER * 2
      const type = pickType()
      const agent = new AIAgent(x, z, this.physics, type)
      const mesh  = makeAgentMesh(type)
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

  /** Spawn count infantry agents near world position (x, z) — used by boss reinforcement. */
  spawnReinforcement(x: number, z: number, count = 2): void {
    for (let i = 0; i < count; i++) {
      const ox   = x + (Math.random() - 0.5) * 14
      const oz   = z + (Math.random() - 0.5) * 14
      const type = pickType()
      const agent = new AIAgent(ox, oz, this.physics, type)
      const mesh  = makeAgentMesh(type)
      mesh.position.set(ox, 1, oz)
      this.scene.add(mesh)
      agent.mesh = mesh
      this.agents.push(agent)
    }
  }

  /** Exposes all infantry agents (for difficulty HP scaling at game start) */
  getAgents(): AIAgent[] { return this.agents }

  /** All special enemies as objects with a public `hp` field */
  getSpecialEnemies(): Array<{ hp: number; alive: boolean }> {
    return [...this.snipers, ...this.robots, ...this.drones, ...this.tanks]
  }

  /** Toggle NV emissive glow on all infantry meshes */
  private setNVGlow(active: boolean): void {
    const emissive = active ? 0x00ff55 : 0x000000
    const intensity = active ? 0.45 : 0
    for (const agent of this.agents) {
      if (!agent.mesh) continue
      agent.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material
          if (Array.isArray(mat)) {
            mat.forEach(m => {
              if (m instanceof THREE.MeshStandardMaterial) {
                m.emissive.setHex(emissive); m.emissiveIntensity = intensity
              }
            })
          } else if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.setHex(emissive); mat.emissiveIntensity = intensity
          }
        }
      })
    }
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
