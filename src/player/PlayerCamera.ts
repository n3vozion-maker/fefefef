import * as THREE from 'three'
import { Settings } from '../core/Settings'
import { bus }      from '../core/EventBus'

const HEAD_BOB_FREQ  = 13
const HEAD_BOB_AMP   = 0.035
const FOV_LERP       = 12
const TILT_SPEED     = 10
const SLIDE_BOB_AMP  = 0.015
const RECOIL_RECOVER = 5.5
const SHAKE_DECAY    = 16

export class PlayerCamera {
  private yaw         = 0
  private pitch       = 0
  private bobTime     = 0
  private targetFov:  number
  private currentFov: number
  private isADS       = false
  private roll        = 0
  private targetRoll  = 0

  // Recoil
  private recoilPitch = 0
  private recoilYaw   = 0

  // Screen shake
  private shakeX = 0
  private shakeY = 0

  constructor(private cam: THREE.PerspectiveCamera) {
    this.currentFov = Settings.fov
    this.targetFov  = Settings.fov
    cam.fov = Settings.fov
    cam.updateProjectionMatrix()

    bus.on<boolean>('adsChanged', (active) => {
      this.isADS     = active
      this.targetFov = active ? Settings.adsFov : Settings.fov
    })

    // Screen shake triggers
    bus.on('explosion',      () => this.shake(0.22))
    bus.on('tankCannonFired',() => this.shake(0.18))
    bus.on('bossPhaseChange',() => this.shake(0.48))
    bus.on<{ damage: number }>('playerHit', ({ damage }) => this.shake(damage / 160))
  }

  /** Add a one-shot camera shake. intensity ~0.1 (light) → 0.5 (heavy). */
  shake(intensity: number): void {
    this.shakeX += (Math.random() - 0.5) * intensity * 2
    this.shakeY += (Math.random() - 0.5) * intensity * 2
  }

  applyMouseDelta(dx: number, dy: number): void {
    this.yaw   -= dx * Settings.mouseSensitivity
    this.pitch -= dy * Settings.mouseSensitivity
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
  }

  applyRecoil(pitchAmount: number, yawAmount: number): void {
    const mult = this.isADS ? 0.45 : 1.0
    this.recoilPitch += pitchAmount * mult
    this.recoilYaw   += (Math.random() - 0.5) * yawAmount * 2 * mult
  }

  setWallTilt(side: 'left' | 'right' | null): void {
    const rad = THREE.MathUtils.degToRad(12)
    this.targetRoll = side === 'right' ? -rad : side === 'left' ? rad : 0
  }

  getMuzzleOrigin(): THREE.Vector3 {
    return this.cam.position.clone()
  }

  getMuzzleDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1)
    dir.applyQuaternion(this.cam.quaternion)
    return dir
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

    // Recoil recovery
    this.recoilPitch *= Math.max(0, 1 - RECOIL_RECOVER * dt)
    this.recoilYaw   *= Math.max(0, 1 - RECOIL_RECOVER * dt)
    this.pitch -= this.recoilPitch * dt * 60
    this.yaw   -= this.recoilYaw   * dt * 60
    this.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))

    // Roll
    this.roll += (this.targetRoll - this.roll) * Math.min(1, TILT_SPEED * dt)

    this.cam.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'))

    // Head bob
    let bobX = 0, bobY = 0
    if (moving && !this.isADS) {
      const isSliding = state === 'slide'
      const freq = isSliding ? HEAD_BOB_FREQ * 0.5 : sprinting ? HEAD_BOB_FREQ * 1.4 : HEAD_BOB_FREQ
      const amp  = isSliding ? SLIDE_BOB_AMP : HEAD_BOB_AMP
      this.bobTime += dt * freq
      bobY = Math.sin(this.bobTime)       * amp
      bobX = Math.sin(this.bobTime * 0.5) * amp * 0.4
    } else {
      this.bobTime = 0
    }

    // Shake decay
    this.shakeX *= Math.max(0, 1 - SHAKE_DECAY * dt)
    this.shakeY *= Math.max(0, 1 - SHAKE_DECAY * dt)

    this.cam.position.set(
      basePos.x + bobX + this.shakeX,
      basePos.y + bobY + this.shakeY,
      basePos.z,
    )
  }

  getYaw():   number { return this.yaw }
  getPitch(): number { return this.pitch }
}
