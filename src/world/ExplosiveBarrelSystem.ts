import * as THREE  from 'three'
import * as CANNON from 'cannon-es'
import { bus }             from '../core/EventBus'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import { getTerrainHeight }  from './TerrainNoise'

const BLAST_RADIUS  = 5.5
const BLAST_DAMAGE  = 80
const CHAIN_DELAY   = 240   // ms before chained barrels detonate
const CHAIN_RADIUS  = 6.0   // chain trigger distance
const FIRE_LIFETIME = 6.0   // seconds fire lingers

interface Barrel {
  id:    string
  mesh:  THREE.Mesh
  body:  CANNON.Body
  pos:   THREE.Vector3
  alive: boolean
}

interface FireEmber {
  mesh:  THREE.Mesh
  light: THREE.PointLight
  life:  number
  phase: number
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

const fireGeo = new THREE.SphereGeometry(0.35, 6, 4)

export class ExplosiveBarrelSystem {
  private barrels = new Map<string, Barrel>()
  private fires:   FireEmber[] = []

  constructor(private scene: THREE.Scene, private physics: PhysicsWorld) {
    // Fire update — run in rAF so it's independent of game pause
    const tick = () => { this.updateFire(1 / 60); requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
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
    this.spawnFire(pos)

    // Chain: schedule nearby barrels
    for (const other of this.barrels.values()) {
      if (!other.alive) continue
      if (other.pos.distanceTo(pos) < CHAIN_RADIUS) {
        setTimeout(() => this.detonate(other.id), CHAIN_DELAY + Math.random() * 300)
      }
    }
  }

  private spawnFire(pos: THREE.Vector3): void {
    const EMBERS = 5
    for (let i = 0; i < EMBERS; i++) {
      const mat  = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, depthWrite: false })
      const mesh = new THREE.Mesh(fireGeo, mat)
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.2 + Math.random() * 0.6,
        (Math.random() - 0.5) * 1.5,
      ))
      this.scene.add(mesh)

      const light = new THREE.PointLight(0xff4400, 1.8, 6)
      light.position.copy(mesh.position)
      this.scene.add(light)

      this.fires.push({
        mesh, light,
        life:  FIRE_LIFETIME * (0.8 + Math.random() * 0.4),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  private updateFire(dt: number): void {
    const t = performance.now() * 0.001
    for (const f of this.fires) {
      f.life -= dt
      const frac = Math.max(0, f.life / FIRE_LIFETIME)
      // Flicker scale
      const flicker = 0.8 + 0.4 * Math.sin(t * 8 + f.phase) + 0.2 * Math.sin(t * 13 + f.phase * 2)
      f.mesh.scale.setScalar(flicker * (0.5 + frac * 0.6))
      ;(f.mesh.material as THREE.MeshBasicMaterial).opacity = frac * 0.85
      // Shift colour from orange to red as fire dies
      const r = Math.floor(255)
      const g = Math.floor(frac * 120)
      ;(f.mesh.material as THREE.MeshBasicMaterial).color.setRGB(r / 255, g / 255, 0)
      f.light.intensity = frac * 1.8 * flicker
    }
    const dead = this.fires.filter(f => f.life <= 0)
    for (const f of dead) { this.scene.remove(f.mesh); this.scene.remove(f.light) }
    this.fires = this.fires.filter(f => f.life > 0)
  }
}
