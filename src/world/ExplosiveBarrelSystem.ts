import * as THREE  from 'three'
import * as CANNON from 'cannon-es'
import { bus }             from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { getTerrainHeight }  from './TerrainNoise'

const BLAST_RADIUS  = 5.5
const BLAST_DAMAGE  = 80
const CHAIN_DELAY   = 240   // ms before chained barrels detonate
const CHAIN_RADIUS  = 6.0   // chain trigger distance

interface Barrel {
  id:    string
  mesh:  THREE.Mesh
  body:  CANNON.Body
  pos:   THREE.Vector3
  alive: boolean
}

const barrelGeo  = new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10)
const barrelMat  = new THREE.MeshStandardMaterial({ color: 0xcc2200, roughness: 0.75, metalness: 0.45 })
const bandMat    = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.6 })
const bandGeo    = new THREE.CylinderGeometry(0.235, 0.235, 0.04, 10)

// Spawn sites: [x, z, count]
const BARREL_SITES: Array<[number, number, number]> = [
  [ 580, -380, 5],   // base alpha
  [-680,  820, 5],   // base bravo
  [ 200,-1180, 3],   // village north
  [1080,  120, 3],   // outpost east
  [-890, -180, 3],   // outpost west
  [ 410,  310, 2],   // mid-map camp
  [ 710, -680, 2],   // south camp
  [-490, -780, 2],   // south-west camp
]

let _nextId = 1

export class ExplosiveBarrelSystem {
  private barrels = new Map<string, Barrel>()

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    this.spawnAll()
    bus.on<{ barrelId: string }>('barrelHit', (e) => this.detonate(e.barrelId))
    // Also detonate from nearby blast damage
    bus.on<{ position: THREE.Vector3; radius: number }>('blastDamage', (e) => {
      for (const barrel of this.barrels.values()) {
        if (!barrel.alive) continue
        if (barrel.pos.distanceTo(e.position) < Math.min(e.radius, CHAIN_RADIUS)) {
          setTimeout(() => this.detonate(barrel.id), CHAIN_DELAY + Math.random() * 200)
        }
      }
    })
  }

  private spawnAll(): void {
    for (const [cx, cz, count] of BARREL_SITES) {
      for (let i = 0; i < count; i++) {
        const x = cx + (Math.random() - 0.5) * 12
        const z = cz + (Math.random() - 0.5) * 12
        const y = getTerrainHeight(x, z)
        this.spawnBarrel(x, y, z)
      }
    }
  }

  private spawnBarrel(x: number, groundY: number, z: number): void {
    const id  = `barrel_${_nextId++}`
    const pos = new THREE.Vector3(x, groundY + 0.30, z)

    // Mesh — cylinder body + two bands
    const group = new THREE.Group()
    const body  = new THREE.Mesh(barrelGeo, barrelMat)
    body.castShadow = true
    group.add(body)
    for (const oy of [-0.18, 0.18]) {
      const band = new THREE.Mesh(bandGeo, bandMat)
      band.position.y = oy
      group.add(band)
    }
    group.position.copy(pos)
    this.scene.add(group)

    // Physics — simple sphere for collision detection
    const phyBody = new CANNON.Body({ mass: 0 })
    phyBody.addShape(new CANNON.Cylinder(0.22, 0.22, 0.56, 8))
    phyBody.position.set(pos.x, pos.y, pos.z)
    ;(phyBody as unknown as Record<string, unknown>)['barrelId'] = id
    this.physics.addBody(phyBody)

    const barrel: Barrel = {
      id,
      mesh:  group as unknown as THREE.Mesh,
      body:  phyBody,
      pos:   pos.clone(),
      alive: true,
    }
    this.barrels.set(id, barrel)
  }

  private detonate(id: string): void {
    const barrel = this.barrels.get(id)
    if (!barrel?.alive) return
    barrel.alive = false

    // Remove mesh
    this.scene.remove(barrel.mesh)
    // Remove physics body
    this.physics.removeBody(barrel.body)

    const pos = barrel.pos.clone()
    bus.emit('explosion',   { position: pos })
    bus.emit('blastDamage', { position: pos, radius: BLAST_RADIUS, damage: BLAST_DAMAGE })

    // Chain: schedule nearby barrels
    for (const other of this.barrels.values()) {
      if (!other.alive) continue
      if (other.pos.distanceTo(pos) < CHAIN_RADIUS) {
        setTimeout(() => this.detonate(other.id), CHAIN_DELAY + Math.random() * 300)
      }
    }
  }
}
