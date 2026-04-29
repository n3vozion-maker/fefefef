import * as THREE from 'three'
import { bus }    from '../core/EventBus'

const GRAVITY    = 28      // m/s² (fast-paced feel)
const THROW_SPD  = 18      // m/s forward
const THROW_ARC  =  6      // m/s upward
const FUSE       =  1.5    // s
const BLAST_R    =  7      // m radius
const BLAST_DMG  =  150    // max damage
const MAX_CARRY  =  10

const geo = new THREE.SphereGeometry(0.09, 6, 4)
const mat = new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.8 })

interface Grenade {
  mesh:     THREE.Mesh
  pos:      THREE.Vector3
  vel:      THREE.Vector3
  timer:    number
}

export class GrenadeSystem {
  count    = MAX_CARRY
  private grenades: Grenade[] = []

  addGrenades(n: number): void {
    this.count = Math.min(MAX_CARRY, this.count + n)
  }

  constructor(private scene: THREE.Scene) {}

  throw(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.count <= 0) return false
    this.count--

    const vel = direction.clone().multiplyScalar(THROW_SPD)
    vel.y += THROW_ARC

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    mesh.castShadow = false
    this.scene.add(mesh)

    this.grenades.push({ mesh, pos: origin.clone(), vel, timer: 0 })
    bus.emit('grenadeThrown', undefined)
    return true
  }

  update(dt: number): void {
    const toRemove: Grenade[] = []

    for (const g of this.grenades) {
      g.timer += dt

      // Physics
      g.vel.y -= GRAVITY * dt
      g.pos.addScaledVector(g.vel, dt)

      // Cheap ground bounce (terrain height is complex — bounce at y=0 fallback)
      if (g.pos.y < 0.09) {
        g.pos.y = 0.09
        g.vel.y *= -0.35
        g.vel.x *=  0.7
        g.vel.z *=  0.7
      }

      g.mesh.position.copy(g.pos)
      // Rolling rotation
      g.mesh.rotation.x += g.vel.length() * dt * 0.8

      if (g.timer >= FUSE) {
        this.explode(g)
        toRemove.push(g)
      }
    }

    for (const g of toRemove) {
      this.scene.remove(g.mesh)
      this.grenades = this.grenades.filter(x => x !== g)
    }
  }

  private explode(g: Grenade): void {
    bus.emit('explosion', {
      position: g.pos.clone(),
      radius:   BLAST_R,
      damage:   BLAST_DMG,
      agentId:  undefined,   // player-thrown
    })
  }
}
