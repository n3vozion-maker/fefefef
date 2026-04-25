import * as THREE  from 'three'
import * as CANNON  from 'cannon-es'
import { VehicleBase } from './VehicleBase'
import { bus }         from '../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FORCE     = 5000
const MAX_STEER     = 0.3
const BRAKE_FORCE   = 120
const MAX_SPEED     = 12
const CANNON_CD     = 3.5
const CANNON_DAMAGE = 180
const COAX_CD       = 0.1
const COAX_DAMAGE   = 20

const WHEEL_POSITIONS: [number, number, number][] = [
  [-1.7, 0, 2.0], [ 1.7, 0, 2.0],
  [-1.7, 0, 0  ], [ 1.7, 0, 0  ],
  [-1.7, 0,-2.0], [ 1.7, 0,-2.0],
]

// ── TankVehicle (player-drivable) ─────────────────────────────────────────────

export class TankVehicle extends VehicleBase {
  override type = 'tank_veh' as const
  protected override camOffset = new THREE.Vector3(0, 5, -10)

  private turretGroup!: THREE.Group
  private barrelPivot!: THREE.Group
  private turretYaw    = 0
  private cannonCd     = 0
  private coaxCd       = 0

  constructor(
    x: number, y: number, z: number,
    scene: THREE.Scene,
    physics: { world: CANNON.World },
  ) {
    super(scene, physics)

    this.buildChassis(new CANNON.Vec3(1.8, 0.65, 3.5), 12000, x, y, z)

    const wheelOpts = {
      radius:           0.55,
      directionLocal:   new CANNON.Vec3(0, -1, 0),
      suspensionStiffness:       55,
      suspensionRestLength:      0.65,
      frictionSlip:              6.5,
      dampingRelaxation:         2.5,
      dampingCompression:        4.5,
      maxSuspensionForce:        600000,
      rollInfluence:             0.01,
      axleLocal:                 new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
      maxSuspensionTravel:       0.4,
      useCustomSlidingRotationalSpeed: true,
      customSlidingRotationalSpeed: -30,
    }

    for (const [wx, wy, wz] of WHEEL_POSITIONS) {
      this.addWheel({ ...wheelOpts, chassisConnectionPointLocal: new CANNON.Vec3(wx, wy, wz) })
    }

    this.init()
    this.chassisMesh = this.buildMesh()
    scene.add(this.chassisMesh)
  }

  private buildMesh(): THREE.Group {
    const armMat  = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.7, metalness: 0.5 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222a18, roughness: 0.8 })
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    const rimMat  = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.4, metalness: 0.7 })

    const g = new THREE.Group()

    // Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 7.0), armMat)
    hull.castShadow = true
    g.add(hull)

    // Track skirts
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 7.2), darkMat)
      skirt.position.set(side * 1.95, 0, 0)
      skirt.castShadow = true
      g.add(skirt)
    }

    // Turret
    this.turretGroup = new THREE.Group()
    this.turretGroup.position.set(0, 1.0, 0.5)

    const turret = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.85, 2.8), armMat)
    turret.castShadow = true
    this.turretGroup.add(turret)

    // Barrel pivot
    this.barrelPivot = new THREE.Group()
    this.barrelPivot.position.set(0, 0, 1.4)

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 4.5, 8),
      darkMat,
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.z = 2.25
    barrel.castShadow = true

    // Coax MG
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.5, 6), darkMat)
    coax.rotation.x = Math.PI / 2
    coax.position.set(0.32, -0.22, 1.25)

    this.barrelPivot.add(barrel, coax)
    this.turretGroup.add(this.barrelPivot)
    g.add(this.turretGroup)

    // Wheels (6 per side = 12 total)
    for (let i = 0; i < 6; i++) {
      const wg   = new THREE.Group()
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 8, 22), tireMat)
      const rim  = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.09, 12), rimMat)
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
    const speed = this.chassisBody.velocity.length()
    const force = fwd  ?  MAX_FORCE  :
                  back ? -MAX_FORCE * 0.4 : 0
    const steer = left  ?  MAX_STEER :
                  right ? -MAX_STEER : 0

    for (let i = 0; i < 6; i++) {
      this.vehicle.applyEngineForce(speed < MAX_SPEED ? force : 0, i)
    }
    // Front pair steers
    this.vehicle.setSteeringValue( steer, 0)
    this.vehicle.setSteeringValue( steer, 1)

    const brakeF = brake ? BRAKE_FORCE : (fwd || back ? 0 : 15)
    for (let i = 0; i < 6; i++) this.vehicle.setBrake(brakeF, i)

    // Cooldowns
    this.cannonCd -= dt
    this.coaxCd   -= dt
  }

  /** Aim turret toward world direction yaw */
  aimTurret(yaw: number, pitch: number): void {
    this.turretYaw = yaw
    const chassisYaw = this.getChassisYaw()
    this.turretGroup.rotation.y = yaw - chassisYaw
    this.barrelPivot.rotation.x = THREE.MathUtils.clamp(-pitch, -0.35, 0.2)
  }

  private getChassisYaw(): number {
    const e = new CANNON.Vec3()
    this.chassisBody.quaternion.toEuler(e)
    return e.y   // toEuler writes in-place, result is in e.y
  }

  fireMainGun(from: THREE.Vector3, dir: THREE.Vector3): void {
    if (this.cannonCd > 0) return
    this.cannonCd = CANNON_CD
    bus.emit('aiWeaponFired', { origin: from, damage: CANNON_DAMAGE, isTankPlayer: true })
    bus.emit('tankCannonFired', {
      origin:    from,
      direction: dir,
      damage:    CANNON_DAMAGE,
    })
  }

  fireCoax(from: THREE.Vector3): void {
    if (this.coaxCd > 0) return
    this.coaxCd = COAX_CD
    bus.emit('tankCoaxFired', { origin: from, damage: COAX_DAMAGE })
  }
}
