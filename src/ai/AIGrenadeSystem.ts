import * as THREE from 'three'
import { bus }    from '../core/EventBus'

const GRAVITY  = 22
const FUSE     = 2.4
const BLAST_R  = 5.5
const BLAST_DMG = 75

interface AIGrenade {
  mesh:    THREE.Mesh
  warning: THREE.Mesh
  pos:     THREE.Vector3
  vel:     THREE.Vector3
  timer:   number
}

const sphereGeo  = new THREE.SphereGeometry(0.10, 6, 4)
const sphereMat  = new THREE.MeshStandardMaterial({ color: 0x3a4830, roughness: 0.8 })
const ringGeo    = new THREE.RingGeometry(0.25, 1.85, 20)
const ringMatBase = new THREE.MeshBasicMaterial({
  color: 0xff1a1a, transparent: true, opacity: 0.5,
  side: THREE.DoubleSide, depthWrite: false,
})

export class AIGrenadeSystem {
  private grenades: AIGrenade[] = []

  constructor(private scene: THREE.Scene) {
    bus.on<{ origin: THREE.Vector3; target: THREE.Vector3 }>('aiGrenadeThrown', (e) => {
      this.spawn(e.origin, e.target)
    })
  }

  private spawn(origin: THREE.Vector3, target: THREE.Vector3): void {
    const mesh = new THREE.Mesh(sphereGeo, sphereMat)
    mesh.castShadow = false
    mesh.position.copy(origin)
    this.scene.add(mesh)

    // Ballistic velocity toward target
    const diff  = target.clone().sub(origin)
    const hDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z)
    const t     = Math.max(0.6, Math.sqrt(hDist / (GRAVITY * 0.5))) * 0.9
    const vel   = new THREE.Vector3(
      diff.x / t,
      Math.min((diff.y + 0.5 * GRAVITY * t * t) / t, 20),
      diff.z / t,
    )

    // Warning ring placed at approximate landing spot
    const warning = new THREE.Mesh(ringGeo, ringMatBase.clone())
    warning.position.set(target.x, target.y + 0.06, target.z)
    warning.rotation.x = -Math.PI / 2
    this.scene.add(warning)

    this.grenades.push({ mesh, warning, pos: origin.clone(), vel, timer: 0 })
  }

  update(dt: number): void {
    const dead: AIGrenade[] = []

    for (const g of this.grenades) {
      g.timer += dt
      g.vel.y -= GRAVITY * dt
      g.pos.addScaledVector(g.vel, dt)

      if (g.pos.y < 0.1) {
        g.pos.y  = 0.1
        g.vel.y *= -0.18
        g.vel.x *= 0.65
        g.vel.z *= 0.65
      }
      g.mesh.position.copy(g.pos)
      g.mesh.rotation.x += g.vel.length() * dt * 0.7

      // Warning ring: faster pulse as fuse runs out
      const urgency = g.timer / FUSE
      ;(g.warning.material as THREE.MeshBasicMaterial).opacity =
        0.25 + Math.abs(Math.sin(urgency * Math.PI * (3 + urgency * 4))) * 0.45

      if (g.timer >= FUSE) {
        bus.emit('explosion',   { position: g.pos.clone() })
        bus.emit('blastDamage', { position: g.pos.clone(), radius: BLAST_R, damage: BLAST_DMG })
        dead.push(g)
      }
    }

    for (const g of dead) {
      this.scene.remove(g.mesh)
      this.scene.remove(g.warning)
      this.grenades = this.grenades.filter(x => x !== g)
    }
  }
}
