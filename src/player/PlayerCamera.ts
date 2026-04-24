import * as THREE from 'three'
import { Settings } from '../core/Settings'
import { bus }      from '../core/EventBus'

const HEAD_BOB_FREQ  = 13
const HEAD_BOB_AMP   = 0.035
const FOV_LERP       = 12
const TILT_DEG       = 12              // camera roll during wall run (degrees)
const TILT_SPEED     = 10             // lerp speed for tilt
const SLIDE_BOB_AMP  = 0.015          // subtle camera bounce during slide

export class PlayerCamera {
  private yaw         = 0
  private pitch       = 0
  private bobTime     = 0
  private targetFov:  number
  private currentFov: number
  private isADS       = false
  private roll        = 0
  private targetRoll  = 0

  constructor(private cam: THREE.PerspectiveCamera) {
    this.currentFov = Settings.fov
    this.targetFov  = Settings.fov
    cam.fov = Settings.fov
    cam.updateProjectionMatrix()

    bus.on<boolean>('adsChanged', (active) => {
      this.isADS     = active
      this.targetFov = active ? Settings.adsFov : Settings.fov
    })
  }

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw   -= dx * Settings.mouseSensitivity
    this.pitch -= dy * Settings.mouseSensitivity
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
  }

  setWallTilt(side: 'left' | 'right' | null): void {
    const rad = THREE.MathUtils.degToRad(TILT_DEG)
    this.targetRoll = side === 'right' ? -rad : side === 'left' ? rad : 0
  }

  update(
    dt:        number,
    basePos:   THREE.Vector3,
    moving:    boolean,
    sprinting: boolean,
    state?:    string,
  ): void {
    // FOV
    this.currentFov += (this.targetFov - this.currentFov) * Math.min(1, FOV_LERP * dt)
    this.cam.fov = this.currentFov
    this.cam.updateProjectionMatrix()

    // Roll (wall run tilt)
    this.roll += (this.targetRoll - this.roll) * Math.min(1, TILT_SPEED * dt)

    // Rotation — YXZ so yaw applied first, then pitch, then roll
    this.cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'))

    // Head bob
    let bobX = 0
    let bobY = 0
    if (moving && !this.isADS) {
      const isSliding = state === 'slide'
      const freq = isSliding ? HEAD_BOB_FREQ * 0.5
                 : sprinting  ? HEAD_BOB_FREQ * 1.4
                 :              HEAD_BOB_FREQ
      const amp  = isSliding ? SLIDE_BOB_AMP : HEAD_BOB_AMP
      this.bobTime += dt * freq
      bobY = Math.sin(this.bobTime)       * amp
      bobX = Math.sin(this.bobTime * 0.5) * amp * 0.4
    } else {
      this.bobTime = 0
    }

    this.cam.position.set(basePos.x + bobX, basePos.y + bobY, basePos.z)
  }

  getYaw():   number { return this.yaw }
  getPitch(): number { return this.pitch }
}
