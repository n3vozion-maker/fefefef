import * as THREE  from 'three'
import * as CANNON  from 'cannon-es'
import { VehicleBase } from './VehicleBase'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FORCE   = 1800
const MAX_STEER   = 0.45
const BRAKE_FORCE = 55
const MAX_SPEED   = 28   // m/s ~100 km/h

// Wheel positions [x, y, z] — 4WD layout
const WHEEL_POSITIONS: [number, number, number][] = [
  [-0.9, 0, 1.35],   // FL
  [ 0.9, 0, 1.35],   // FR
  [-0.9, 0,-1.35],   // RL
  [ 0.9, 0,-1.35],   // RR
]

// ── Car ───────────────────────────────────────────────────────────────────────

export class Car extends VehicleBase {
  override type      = 'car' as const
  override maxHealth = 600
  override maxFuel   = 80
  override fuelDrain = 2.2

  constructor(
    x: number, y: number, z: number,
    scene: THREE.Scene,
    physics: { world: CANNON.World },
  ) {
    super(scene, physics)

    this.buildChassis(new CANNON.Vec3(1.0, 0.5, 2.1), 1200, x, y, z)

    const wheelOpts = {
      radius:           0.4,
      directionLocal:   new CANNON.Vec3(0, -1, 0),
      suspensionStiffness:       28,
      suspensionRestLength:      0.55,
      frictionSlip:              5.5,
      dampingRelaxation:         2.3,
      dampingCompression:        4.2,
      maxSuspensionForce:        100000,
      rollInfluence:             0.07,
      axleLocal:                 new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      maxSuspensionTravel:       0.35,
      useCustomSlidingRotationalSpeed: true,
      customSlidingRotationalSpeed:    -30,
    }

    for (const [wx, wy, wz] of WHEEL_POSITIONS) {
      this.addWheel({
        ...wheelOpts,
        chassisConnectionPointLocal: new CANNON.Vec3(wx, wy, wz),
      })
    }

    this.init()
    this.chassisMesh = this.buildMesh()
    scene.add(this.chassisMesh)
  }

  private buildMesh(): THREE.Group {
    const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.3, metalness: 0.5 })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88bbcc, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.1,
    })
    const tireMat  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    const rimMat   = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.8 })
    const g = new THREE.Group()

    // Chassis body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.2), bodyMat)
    body.castShadow = true
    g.add(body)

    // Cab / roof
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.1), bodyMat)
    cab.position.set(0, 0.8, -0.1)
    cab.castShadow = true
    g.add(cab)

    // Windshield
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 0.08), glassMat)
    wind.position.set(0, 0.85, 0.98)
    wind.rotation.x = -0.25
    g.add(wind)

    // Rear window
    const rear = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 0.08), glassMat)
    rear.position.set(0, 0.82, -1.18)
    rear.rotation.x = 0.25
    g.add(rear)

    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    for (const side of [-0.7, 0.7]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.06), hlMat)
      hl.position.set(side, 0.08, 2.12)
      g.add(hl)
    }

    // Wheels
    for (let i = 0; i < 4; i++) {
      const wg   = new THREE.Group()
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.13, 8, 22), tireMat)
      const rim  = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 12), rimMat)
      rim.rotation.x = Math.PI / 2
      wg.add(tire, rim)
      this.scene.add(wg)
      this.wheelMeshes.push(wg as unknown as THREE.Mesh)
    }

    return g
  }

  applyInput(
    fwd: boolean, back: boolean,
    left: boolean, right: boolean,
    brake: boolean,
    dt: number,
  ): void {
    const moving = fwd || back
    this.tickFuel(dt, moving)

    const speed    = this.chassisBody.velocity.length()
    const canDrive = this.hasFuel() && this.alive
    const force    = canDrive ? (fwd ? MAX_FORCE : back ? -MAX_FORCE * 0.5 : 0) : 0
    const steer    = left ? MAX_STEER : right ? -MAX_STEER : 0

    for (let i = 0; i < 4; i++) {
      this.vehicle.applyEngineForce(speed < MAX_SPEED ? force : 0, i)
    }
    this.vehicle.setSteeringValue(steer, 0)
    this.vehicle.setSteeringValue(steer, 1)

    const brakeF = brake ? BRAKE_FORCE : (fwd || back ? 0 : 6)
    for (let i = 0; i < 4; i++) {
      this.vehicle.setBrake(brakeF, i)
    }
  }
}
