import * as THREE from 'three'
import { bus }    from '../core/EventBus'

const DURATION = 3.2   // seconds before handing off to game-over

export class KillcamSystem {
  private overlay:   HTMLElement
  private active     = false
  private timer      = 0
  private savedPos   = new THREE.Vector3()
  private savedQuat  = new THREE.Quaternion()

  constructor(private camera: THREE.PerspectiveCamera) {
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position:      'fixed',
      inset:         '0',
      background:    'rgba(0,0,0,0.52)',
      display:       'none',
      pointerEvents: 'none',
      zIndex:        '85',
    })

    const label = document.createElement('div')
    Object.assign(label.style, {
      position:      'absolute',
      top:           '13%',
      left:          '50%',
      transform:     'translateX(-50%)',
      color:         '#ff3333',
      fontFamily:    'monospace',
      fontSize:      '10px',
      letterSpacing: '0.40em',
      textTransform: 'uppercase',
      userSelect:    'none',
    })
    label.textContent = '— KILLCAM —'
    this.overlay.appendChild(label)
    document.body.appendChild(this.overlay)
  }

  trigger(killerPos: THREE.Vector3): void {
    this.active = true
    this.timer  = DURATION
    this.savedPos.copy(this.camera.position)
    this.savedQuat.copy(this.camera.quaternion)

    // Top-down view angled toward killer
    this.camera.position.set(killerPos.x - 4, killerPos.y + 26, killerPos.z + 8)
    this.camera.lookAt(killerPos)
    this.overlay.style.display = 'block'
  }

  isActive(): boolean { return this.active }

  update(dt: number): void {
    if (!this.active) return
    this.timer -= dt
    if (this.timer <= 0) {
      this.active = false
      this.overlay.style.display = 'none'
      this.camera.position.copy(this.savedPos)
      this.camera.quaternion.copy(this.savedQuat)
      bus.emit('showGameOver', undefined)
    }
  }
}
