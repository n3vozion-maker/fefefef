import * as THREE  from 'three'
import * as CANNON  from 'cannon-es'
import { bus }      from '../core/EventBus'
import { VehicleBase } from './VehicleBase'
import { Motorcycle }  from './Motorcycle'
import { Car }         from './Car'
import { TankVehicle } from './TankVehicle'

// ── Constants ─────────────────────────────────────────────────────────────────

const ENTER_R          = 4.5    // metres to enter a vehicle
const EXIT_PUSH        = 3.0    // push player sideways on exit

// ── VehicleSystem ─────────────────────────────────────────────────────────────

export class VehicleSystem {
  private vehicles: VehicleBase[] = []
  private active:   VehicleBase | null = null
  private camera:   THREE.PerspectiveCamera

  // Third-person camera state
  private camPos    = new THREE.Vector3()
  private camTarget = new THREE.Vector3()

  constructor(
    private scene:   THREE.Scene,
    private physics: { world: CANNON.World },
    camera: THREE.PerspectiveCamera,
  ) {
    this.camera = camera
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────

  spawnMotorcycle(x: number, y: number, z: number): Motorcycle {
    const m = new Motorcycle(x, y, z, this.scene, this.physics)
    this.vehicles.push(m)
    return m
  }

  spawnCar(x: number, y: number, z: number): Car {
    const c = new Car(x, y, z, this.scene, this.physics)
    this.vehicles.push(c)
    return c
  }

  spawnTank(x: number, y: number, z: number): TankVehicle {
    const t = new TankVehicle(x, y, z, this.scene, this.physics)
    this.vehicles.push(t)
    return t
  }

  // ── Enter / Exit ──────────────────────────────────────────────────────────

  tryEnter(playerPos: THREE.Vector3): boolean {
    if (this.active) return false

    let nearest: VehicleBase | null = null
    let nearestDist = ENTER_R

    for (const v of this.vehicles) {
      const d = v.getPosition().distanceTo(playerPos)
      if (d < nearestDist) {
        nearestDist = d
        nearest = v
      }
    }

    if (nearest) {
      this.active = nearest
      nearest.enter()
      return true
    }
    return false
  }

  tryExit(playerBody: CANNON.Body): void {
    if (!this.active) return
    const vPos = this.active.getPosition()

    // Place player beside vehicle
    const side = new THREE.Vector3(EXIT_PUSH, 1, 0).applyQuaternion(
      new THREE.Quaternion(
        this.active.chassisBody.quaternion.x,
        this.active.chassisBody.quaternion.y,
        this.active.chassisBody.quaternion.z,
        this.active.chassisBody.quaternion.w,
      ),
    )
    playerBody.position.set(
      vPos.x + side.x,
      vPos.y + side.y + 1,
      vPos.z + side.z,
    )
    playerBody.velocity.set(0, 0, 0)

    this.active.exit()
    this.active = null
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(
    dt: number,
    fwd: boolean, back: boolean, left: boolean, right: boolean,
    brakeLeft: boolean, brakeRight: boolean,
    playerPos: THREE.Vector3,
    playerBody: CANNON.Body,
    camYaw: number,
    camPitch: number,
  ): void {
    // Update all vehicles (physics sync)
    for (const v of this.vehicles) v.update()

    if (!this.active) return

    this.active.applyInput(fwd, back, left, right, brakeLeft, dt)

    // Turret aiming for player tank
    if (this.active instanceof TankVehicle) {
      this.active.aimTurret(camYaw, camPitch)

      const vPos   = this.active.getPosition()
      const muzzle = vPos.clone().add(new THREE.Vector3(0, 3.5, 5))
      const camDir = new THREE.Vector3(0, 0, 1)
        .applyEuler(new THREE.Euler(camPitch, camYaw, 0, 'YXZ'))

      if (brakeLeft)  this.active.fireMainGun(muzzle, camDir)
      if (brakeRight) this.active.fireCoax(muzzle)
    }

    // ── Third-person camera ────────────────────────────────────────────────

    const targetCamPos = this.active.getCameraTarget()
    const targetLookAt = this.active.getCameraLookAt()

    this.camPos.lerp(targetCamPos, Math.min(1, dt * 8))
    this.camTarget.lerp(targetLookAt, Math.min(1, dt * 10))

    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.camTarget)
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  get isOccupied(): boolean { return this.active !== null }
  get activeVehicle(): VehicleBase | null { return this.active }

  getNearestDistance(playerPos: THREE.Vector3): number {
    let best = Infinity
    for (const v of this.vehicles) {
      const d = v.getPosition().distanceTo(playerPos)
      if (d < best) best = d
    }
    return best
  }

  getActivePosition(): THREE.Vector3 | null {
    return this.active ? this.active.getPosition() : null
  }

  dispose(): void {
    for (const v of this.vehicles) v.dispose()
    this.vehicles.length = 0
    this.active = null
  }
}
