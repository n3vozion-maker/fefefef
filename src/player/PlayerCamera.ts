import * as THREE from 'three'
import { Settings } from '../core/Settings'
import { bus } from '../core/EventBus'

const HEAD_BOB_FREQ = 13
const HEAD_BOB_AMP  = 0.035
const FOV_LERP      = 12

export class PlayerCamera {
  private yaw   = 0
  private pitch = 0
  private bobTime = 0
  private targetFov: number
  private currentFov: number
  private isADS = false

  constructor(private cam: THREE.PerspectiveCamera) {
    this.currentFov = Settings.fov
    this.targetFov  = Settings.fov
    cam.fov = Settings.fov
    cam.updateProjectionMatrix()

    bus.on<boolean>('adsChanged', (active) => {
      this.isADS   = active
      this.targetFov = active ? Settings.adsFov : Settings.fov
    })
  }

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw   -= dx * Settings.mouseSensitivity
    this.pitch -= dy * Settings.mouseSensitivity
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
  }

  update(dt: number, basePos: THREE.Vector3, moving: boolean, sprinting: boolean): void {
    // FOV lerp
    this.currentFov += (this.targetFov - this.currentFov) * Math.min(1, FOV_LERP * dt)
    this.cam.fov = this.currentFov
    this.cam.updateProjectionMatrix()

    // Rotation
    this.cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))

    // Head bob
    let bobX = 0
    let bobY = 0
    if (moving && !this.isADS) {
      const freq = sprinting ? HEAD_BOB_FREQ * 1.4 : HEAD_BOB_FREQ
      this.bobTime += dt * freq
      bobY = Math.sin(this.bobTime)       * HEAD_BOB_AMP
      bobX = Math.sin(this.bobTime * 0.5) * HEAD_BOB_AMP * 0.4
    } else {
      this.bobTime = 0
    }

    this.cam.position.set(basePos.x + bobX, basePos.y + bobY, basePos.z)
  }

  getYaw():   number { return this.yaw }
  getPitch(): number { return this.pitch }
}
