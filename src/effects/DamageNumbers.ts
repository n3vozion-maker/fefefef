import * as THREE from 'three'
import { bus }    from '../core/EventBus'

interface FloatingNum {
  el:    HTMLElement
  pos:   THREE.Vector3
  vel:   number
  timer: number
  life:  number
}

const LIFE      = 0.90
const POOL_SIZE = 32

export class DamageNumbers {
  private active: FloatingNum[] = []
  private pool:   HTMLElement[]
  private root:   HTMLElement

  constructor(private camera: THREE.Camera) {
    this.root = document.createElement('div')
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      fontFamily: 'monospace', zIndex: '15', overflow: 'hidden',
    })
    document.body.appendChild(this.root)

    this.pool = Array.from({ length: POOL_SIZE }, () => {
      const el = document.createElement('div')
      Object.assign(el.style, {
        position:  'absolute',
        fontWeight: 'bold',
        textShadow: '0 1px 4px rgba(0,0,0,0.95)',
        transform:  'translate(-50%,-50%)',
        display:    'none',
        userSelect: 'none',
        pointerEvents: 'none',
      })
      this.root.appendChild(el)
      return el
    })

    bus.on<{ damage: number; position: THREE.Vector3 }>('damageEvent', (e) => {
      this.spawn(e.damage, e.position)
    })
  }

  private spawn(dmg: number, worldPos: THREE.Vector3): void {
    const el = this.pool.find(p => p.style.display === 'none')
    if (!el) return

    const isCrit = dmg >= 65
    const isHigh = dmg >= 35

    el.textContent = `-${Math.round(dmg)}`
    el.style.fontSize  = isCrit ? '17px' : isHigh ? '14px' : '12px'
    el.style.color     = isCrit ? '#ff2626' : isHigh ? '#ffa726' : '#ffffff'
    el.style.display   = 'block'
    el.style.opacity   = '1'

    const pos = worldPos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * 1.4,
      1.6 + Math.random() * 0.6,
      (Math.random() - 0.5) * 1.4,
    ))

    this.active.push({ el, pos, vel: 2.8 + Math.random() * 1.2, timer: 0, life: LIFE })
  }

  update(dt: number): void {
    const W = window.innerWidth
    const H = window.innerHeight

    for (const n of this.active) {
      n.timer += dt
      n.pos.y += n.vel * dt
      n.vel   *= Math.max(0, 1 - 5 * dt)

      const proj = n.pos.clone().project(this.camera)
      if (proj.z > 1) { n.el.style.display = 'none'; continue }

      n.el.style.left    = `${((proj.x + 1) / 2 * W).toFixed(0)}px`
      n.el.style.top     = `${((-proj.y + 1) / 2 * H).toFixed(0)}px`
      n.el.style.opacity = (1 - n.timer / n.life).toFixed(2)
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      if (this.active[i]!.timer >= this.active[i]!.life) {
        this.active[i]!.el.style.display = 'none'
        this.active.splice(i, 1)
      }
    }
  }
}
