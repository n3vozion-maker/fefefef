import * as THREE from 'three'
import { bus }    from '../core/EventBus'

export interface ExplosionPayload {
  position: THREE.Vector3
  radius:   number
  damage:   number
  agentId?: string   // source (undefined = player)
}

export class ExplosionSystem {
  private active: { mesh: THREE.Mesh; light: THREE.PointLight; t: number; radius: number }[] = []

  constructor(private scene: THREE.Scene) {
    bus.on<ExplosionPayload>('explosion', (e) => this.detonate(e.position, e.radius, e.damage, e.agentId))
  }

  detonate(position: THREE.Vector3, radius: number, damage: number, sourceId?: string): void {
    // Damage all agents in radius
    bus.emit('blastDamage', { position, radius, damage, sourceId })

    // Visual — expanding fireball + shockwave ring
    this.spawnFireball(position, radius)
    this.spawnShockwave(position, radius)
  }

  update(dt: number): void {
    for (const e of this.active) {
      e.t += dt / 0.45   // 0.45s animation

      const s = e.radius * Math.pow(e.t, 0.5)
      e.mesh.scale.setScalar(s);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - e.t
      e.light.intensity = 12 * (1 - e.t)

      if (e.t >= 1) {
        this.scene.remove(e.mesh)
        this.scene.remove(e.light)
      }
    }
    this.active = this.active.filter(e => e.t < 1)
  }

  private spawnFireball(pos: THREE.Vector3, radius: number): void {
    const geo  = new THREE.SphereGeometry(1, 8, 6)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    this.scene.add(mesh)

    const light = new THREE.PointLight(0xff4400, 12, radius * 4)
    light.position.copy(pos)
    this.scene.add(light)

    this.active.push({ mesh, light, t: 0, radius })
  }

  private spawnShockwave(pos: THREE.Vector3, radius: number): void {
    const geo  = new THREE.RingGeometry(0.1, 0.4, 24)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0))
    this.scene.add(mesh)

    // Shockwave animation is separate (inline RAF)
    let t = 0
    const tick = () => {
      t += 0.05
      mesh.scale.setScalar(radius * t * 3)
      mat.opacity = (1 - t) * 0.6
      if (t < 1) requestAnimationFrame(tick)
      else this.scene.remove(mesh)
    }
    tick()
  }
}
