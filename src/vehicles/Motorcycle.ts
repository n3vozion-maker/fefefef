import * as THREE  from 'three'
import * as CANNON  from 'cannon-es'
import { VehicleBase } from './VehicleBase'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FORCE   = 700
const MAX_STEER   = 0.5
const BRAKE_FORCE = 40
const MAX_SPEED   = 36   // m/s ~130 km/h

// ── Motorcycle ────────────────────────────────────────────────────────────────

export class Motorcycle extends VehicleBase {
  override type = 'motorcycle' as const
  protected override camOffset = new THREE.Vector3(0, 2.2, -5.5)

  constructor(
    x: number, y: number, z: number,
    scene: THREE.Scene,
    physics: { world: CANNON.World },
  ) {
    super(scene, physics)

    this.buildChassis(new CANNON.Vec3(0.3, 0.5, 1.1), 220, x, y, z)

    const wheelOpts = {
      radius:           0.35,
      directionLocal:   new CANNON.Vec3(0, -1, 0),
      suspensionStiffness:      35,
      suspensionRestLength:     0.45,
      frictionSlip:             4.5,
      dampingRelaxation:        2.3,
      dampingCompression:       4.4,
      maxSuspensionForce:       10000,
      rollInfluence:            0.02,
      axleLocal:                new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      maxSuspensionTravel:      0.3,
      useCustomSlidingRotationalSpeed: true,
      customSlidingRotationalSpeed: -30,
    }

    // Front wheel
    this.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0.9) })
    // Rear wheel
    this.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(0, 0, -0.9) })

    this.init()
    this.chassisMesh = this.buildMesh()
    scene.add(this.chassisMesh)
  }

  private buildMesh(): THREE.Group {
    const mat   = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.4, metalness: 0.7 })
    const acMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.5 })
    const g     = new THREE.Group()

    // Frame / body
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.8, 8), mat)
    frame.rotation.x = Math.PI / 2
    g.add(frame)

    // Fuel tank / seat area
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.95), mat)
    seat.position.y = 0.25
    g.add(seat)

    // Handlebars
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), acMat)
    bars.rotation.z = Math.PI / 2
    bars.position.set(0, 0.38, 0.55)
    g.add(bars)

    // Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    const rimMat   = new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 0.3, metalness: 0.8 })

    for (let i = 0; i < 2; i++) {
      const wg = new THREE.Group()
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 20), wheelMat)
      const rim  = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12), rimMat)
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
  ): void {
    const speed = this.chassisBody.velocity.length()

    const engineForce = fwd  ? MAX_FORCE  :
                        back ? -MAX_FORCE * 0.6 : 0

    const steerVal = left  ? MAX_STEER  :
                     right ? -MAX_STEER : 0

    // Rear wheel drive (index 1)
    this.vehicle.applyEngineForce(speed < MAX_SPEED ? engineForce : 0, 1)
    this.vehicle.applyEngineForce(0, 0)   // front: no engine

    // Front wheel steers (index 0)
    this.vehicle.setSteeringValue(steerVal, 0)

    // Braking
    const brakeForce = brake ? BRAKE_FORCE : (fwd || back ? 0 : 5)
    this.vehicle.setBrake(brakeForce, 0)
    this.vehicle.setBrake(brakeForce, 1)
  }
}
