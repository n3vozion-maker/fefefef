import * as THREE from 'three'
import { bus }    from '../core/EventBus'

interface Tracer {
  mesh:  THREE.Mesh
  mat:   THREE.MeshBasicMaterial
  timer: number
}

const LIFE      = 0.09   // seconds visible
const POOL_SIZE = 40
const W         = 0.010  // tracer width

const geo = new THREE.BoxGeometry(W, W, 1)   // 1m long, scaled per shot

export class TracerSystem {
  private pool:   Tracer[]
  private active: Tracer[] = []
  private _dummy  = new THREE.Object3D()

  constructor(private scene: THREE.Scene) {
    this.pool = Array.from({ length: POOL_SIZE }, () => {
      const mat  = new THREE.MeshBasicMaterial({ color: 0xffe88a, transparent: true, opacity: 0.9, depthWrite: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible       = false
      mesh.frustumCulled = false
      scene.add(mesh)
      return { mesh, mat, timer: LIFE }
    })

    bus.on<{ from: THREE.Vector3; to: THREE.Vector3; category: string }>('bulletTracer', (e) => {
      this.spawn(e.from, e.to, e.category)
    })
  }

  private spawn(from: THREE.Vector3, to: THREE.Vector3, category: string): void {
    const t = this.pool.find(p => !p.mesh.visible)
    if (!t) return

    const color = category === 'sniper'  ? 0xffffff
                : category === 'pistol'  ? 0xaaddff
                : category === 'shotgun' ? 0xffcc44
                : 0xffe88a

    t.mat.color.setHex(color)
    t.mat.opacity  = 0.9
    t.timer        = 0
    t.mesh.visible = true

    const dist = from.distanceTo(to)
    t.mesh.scale.z = dist

    // Position at midpoint, orient toward endpoint
    this._dummy.position.lerpVectors(from, to, 0.5)
    this._dummy.lookAt(to)
    this._dummy.updateMatrix()
    t.mesh.position.copy(this._dummy.position)
    t.mesh.quaternion.copy(this._dummy.quaternion)

    this.active.push(t)
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i]!
      t.timer += dt
      t.mat.opacity = Math.max(0, 1 - t.timer / LIFE) * 0.9
      if (t.timer >= LIFE) {
        t.mesh.visible = false
        this.active.splice(i, 1)
      }
    }
  }
}
