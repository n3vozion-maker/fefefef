import * as THREE  from 'three'
import * as CANNON  from 'cannon-es'
import { bus }      from '../core/EventBus'

// ── VehicleBase ───────────────────────────────────────────────────────────────
// Wraps a CANNON.RaycastVehicle, manages enter/exit, provides third-person cam.

export type VehicleType = 'motorcycle' | 'car' | 'tank_veh'

export abstract class VehicleBase {
  vehicle:       CANNON.RaycastVehicle
  chassisBody:   CANNON.Body
  chassisMesh:   THREE.Group = new THREE.Group()   // subclass replaces in constructor
  occupied       = false
  abstract type: VehicleType

  // ── Health & fuel ──────────────────────────────────────────────────────────
  abstract maxHealth: number
  abstract maxFuel:   number
  abstract fuelDrain: number   // litres per second while moving

  health = 100   // overwritten after buildChassis by subclass
  fuel   = 100   // overwritten after buildChassis by subclass
  alive  = true

  // Third-person cam anchor
  protected camOffset = new THREE.Vector3(0, 3, -7)

  // Wheel meshes (managed by subclass)
  protected wheelMeshes: THREE.Mesh[] = []

  constructor(
    protected scene:   THREE.Scene,
    protected physics: { world: CANNON.World },
  ) {
    // Subclass must call buildChassis() and addWheels() in constructor
    this.chassisBody = new CANNON.Body({ mass: 1 })   // placeholder
    this.vehicle     = new CANNON.RaycastVehicle({ chassisBody: this.chassisBody })
  }

  protected buildChassis(
    halfExtents: CANNON.Vec3,
    mass: number,
    x: number, y: number, z: number,
  ): void {
    const shape = new CANNON.Box(halfExtents)
    this.chassisBody = new CANNON.Body({ mass })
    this.chassisBody.addShape(shape)
    this.chassisBody.position.set(x, y, z)
    this.chassisBody.linearDamping  = 0.3
    this.chassisBody.angularDamping = 0.5
    ;(this.chassisBody as unknown as Record<string,unknown>).isVehicle = true
    ;(this.chassisBody as unknown as Record<string,unknown>).vehicleRef = this

    this.vehicle = new CANNON.RaycastVehicle({ chassisBody: this.chassisBody })
  }

  protected addWheel(options: CANNON.WheelInfoOptions): void {
    this.vehicle.addWheel(options)
  }

  init(): void {
    this.vehicle.addToWorld(this.physics.world)
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  abstract applyInput(
    fwd: boolean, back: boolean,
    left: boolean, right: boolean,
    brake: boolean, dt: number,
  ): void

  // ── Camera ────────────────────────────────────────────────────────────────

  getCameraTarget(): THREE.Vector3 {
    const pos = new THREE.Vector3(
      this.chassisBody.position.x,
      this.chassisBody.position.y,
      this.chassisBody.position.z,
    )
    const quat = new THREE.Quaternion(
      this.chassisBody.quaternion.x,
      this.chassisBody.quaternion.y,
      this.chassisBody.quaternion.z,
      this.chassisBody.quaternion.w,
    )
    const offset = this.camOffset.clone().applyQuaternion(quat)
    return pos.add(offset)
  }

  getCameraLookAt(): THREE.Vector3 {
    return new THREE.Vector3(
      this.chassisBody.position.x,
      this.chassisBody.position.y + 1.5,
      this.chassisBody.position.z,
    )
  }

  // ── Health & fuel API ─────────────────────────────────────────────────────

  takeDamage(dmg: number): void {
    if (!this.alive) return
    this.health = Math.max(0, this.health - dmg)
    bus.emit('vehicleDamaged', { type: this.type, health: this.health, max: this.maxHealth })
    if (this.health <= 0) this.destroy()
  }

  repair(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount)
    bus.emit('vehicleDamaged', { type: this.type, health: this.health, max: this.maxHealth })
  }

  refuel(amount: number): void {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount)
    bus.emit('vehicleFueled', { type: this.type, fuel: this.fuel, max: this.maxFuel })
  }

  hasFuel(): boolean { return this.fuel > 0 }

  protected tickFuel(dt: number, moving: boolean): void {
    if (!moving || !this.hasFuel()) return
    this.fuel = Math.max(0, this.fuel - this.fuelDrain * dt)
    bus.emit('vehicleFueled', { type: this.type, fuel: this.fuel, max: this.maxFuel })
  }

  private destroy(): void {
    this.alive    = false
    const pos     = this.getPosition()
    bus.emit('explosion',   { position: pos.clone(), scale: 1.8 })
    bus.emit('blastDamage', { position: pos, radius: 10, damage: 200 })
    if (this.occupied) this.exit()
    this.vehicle.removeFromWorld(this.physics.world)
    this.scene.remove(this.chassisMesh)
    for (const w of this.wheelMeshes) this.scene.remove(w)
    bus.emit('vehicleDestroyed', { type: this.type })
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(): void {
    // Sync chassis mesh
    this.chassisMesh.position.set(
      this.chassisBody.position.x,
      this.chassisBody.position.y,
      this.chassisBody.position.z,
    )
    this.chassisMesh.quaternion.set(
      this.chassisBody.quaternion.x,
      this.chassisBody.quaternion.y,
      this.chassisBody.quaternion.z,
      this.chassisBody.quaternion.w,
    )

    // Sync wheel meshes
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i)
      const wi = this.vehicle.wheelInfos[i]
      const m  = this.wheelMeshes[i]
      if (wi && m) {
        const t = wi.worldTransform
        m.position.set(t.position.x, t.position.y, t.position.z)
        m.quaternion.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w)
      }
    }
  }

  // ── Enter / Exit ──────────────────────────────────────────────────────────

  enter(): void {
    this.occupied = true
    bus.emit('vehicleEntered', { type: this.type })
  }

  exit(): void {
    this.occupied = false
    bus.emit('vehicleExited', { type: this.type })
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.chassisBody.position.x,
      this.chassisBody.position.y,
      this.chassisBody.position.z,
    )
  }

  dispose(): void {
    this.vehicle.removeFromWorld(this.physics.world)
    this.scene.remove(this.chassisMesh)
    for (const w of this.wheelMeshes) this.scene.remove(w)
  }
}
