import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }     from '../../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const HP              = 1200
const HULL_ARMOUR     = 40        // damage reduction from front/sides
const BACK_ARMOUR     = 10        // back is weaker
const TREAD_ARMOUR    = 5         // treads = soft spot (tread attacks do ×2)
const MOVE_SPEED      = 5.5
const TURN_RATE       = 0.9       // radians / second turret tracking
const CANNON_CD       = 3.0       // main gun reload
const CANNON_RANGE    = 200
const CANNON_DMG      = 150
const COAX_CD         = 0.12      // coaxial MG
const COAX_DMG        = 18
const COAX_RANGE      = 80
const AGGRO_R         = 180
const EXPLOSION_R     = 14
const EXPLOSION_DMG   = 300

// ── EnemyTank ─────────────────────────────────────────────────────────────────

export class EnemyTank {
  body:     CANNON.Body
  mesh:     THREE.Group
  hp        = HP
  alive     = true

  private turretGroup: THREE.Group
  private barrelGroup:  THREE.Group
  private turretYaw    = 0
  private cannonCd     = 0
  private coaxCd       = 0
  private _shellsArr: Array<{
    pos: THREE.Vector3
    vel: THREE.Vector3
    mesh: THREE.Mesh
    life: number
  }> = []

  constructor(
    wx: number, wz: number,
    private physics: { world: CANNON.World },
    private scene: THREE.Scene,
  ) {
    // Physics — big box
    const shape = new CANNON.Box(new CANNON.Vec3(2.2, 0.8, 3.2))
    this.body   = new CANNON.Body({ mass: 8000, linearDamping: 0.97, angularDamping: 1 })
    this.body.addShape(shape)
    this.body.position.set(wx, 2, wz)
    ;(this.body as unknown as Record<string,unknown>).agentId  = `tank_${wx}_${wz}`
    ;(this.body as unknown as Record<string,unknown>).isTank   = true
    ;(this.body as unknown as Record<string,unknown>).onDamage = (dmg: number, hit?: { zone: string }) => {
      this.applyDamage(dmg, hit?.zone)
    }
    physics.world.addBody(this.body)

    // ── Mesh ────────────────────────────────────────────────────────────────

    const armourMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.7, metalness: 0.5 })
    const darkMat   = new THREE.MeshStandardMaterial({ color: 0x222a18, roughness: 0.8 })

    // Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 6.4), armourMat)
    hull.castShadow = true

    // Front glacis plate (angled)
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.8, 1.5), armourMat)
    glacis.position.set(0, 0.45, 3.2)
    glacis.rotation.x = -0.45
    glacis.castShadow = true

    // Tracks (left & right)
    for (const side of [-1, 1]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 7.0), darkMat)
      track.position.set(side * 2.4, -0.3, 0)
      track.castShadow = true
      hull.add(track)
    }

    // Turret
    this.turretGroup = new THREE.Group()
    this.turretGroup.position.y = 1.0

    const turret = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 3.0), armourMat)
    turret.castShadow = true

    // Barrel
    this.barrelGroup = new THREE.Group()
    this.barrelGroup.position.z = 1.5

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 3.8, 8),
      darkMat,
    )
    barrel.rotation.x = Math.PI / 2
    barrel.position.z = 1.9
    barrel.castShadow = true

    // Coaxial MG
    const coax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6),
      darkMat,
    )
    coax.rotation.x = Math.PI / 2
    coax.position.set(0.35, -0.2, 1.1)

    this.barrelGroup.add(barrel, coax)
    this.turretGroup.add(turret, this.barrelGroup)

    this.mesh = new THREE.Group()
    this.mesh.add(hull, glacis, this.turretGroup)
    this.mesh.position.set(wx, 2, wz)
    scene.add(this.mesh)
  }

  applyDamage(dmg: number, zone?: string): void {
    if (!this.alive) return

    let reduction = HULL_ARMOUR
    if (zone === 'back')  reduction = BACK_ARMOUR
    if (zone === 'tread') { dmg *= 2; reduction = TREAD_ARMOUR }

    const effective = Math.max(1, dmg - reduction)
    this.hp -= effective

    if (this.hp <= 0) this.die()
  }

  private die(): void {
    this.alive = false
    const pos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)

    // Dramatic chained explosions
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 2,
          (Math.random() - 0.5) * 5,
        )
        bus.emit('explosion', { position: pos.clone().add(offset), scale: 1.6 + Math.random() })
      }, i * 180)
    }

    setTimeout(() => {
      bus.emit('blastDamage', { position: pos, radius: EXPLOSION_R, damage: EXPLOSION_DMG })
    }, 600)

    this.scene.remove(this.mesh)
    this.physics.world.removeBody(this.body)
    bus.emit('agentDied', { agentId: (this.body as unknown as Record<string,unknown>).agentId })
  }

  private fireMainGun(from: THREE.Vector3, dir: THREE.Vector3): void {
    const vel  = dir.clone().multiplyScalar(CANNON_DMG * 0.8)   // fast shell
    const geo  = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffcc44 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(from)
    this.scene.add(mesh)
    this._shellsArr.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(80), mesh, life: 3 })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.alive) return

    const pos = new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z)
    this.mesh.position.copy(pos)
    this.mesh.quaternion.set(
      this.body.quaternion.x, this.body.quaternion.y,
      this.body.quaternion.z, this.body.quaternion.w,
    )

    this.cannonCd -= dt
    this.coaxCd   -= dt

    const dist = pos.distanceTo(playerPos)

    if (dist < AGGRO_R) {
      // Drive toward player (crude)
      const dir = new THREE.Vector3().subVectors(playerPos, pos).setY(0).normalize()
      const forwardImpulse = new CANNON.Vec3(dir.x * MOVE_SPEED * 8000 * dt, 0, dir.z * MOVE_SPEED * 8000 * dt)
      this.body.applyLocalForce(forwardImpulse, new CANNON.Vec3(0, 0, 0))

      // Turret tracking
      const toPlayer = new THREE.Vector3().subVectors(playerPos, pos)
      const targetYaw = Math.atan2(toPlayer.x, toPlayer.z)
      const diff      = ((targetYaw - this.turretYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      this.turretYaw += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt)
      const chassisEuler = new CANNON.Vec3()
      this.body.quaternion.toEuler(chassisEuler)
      this.turretGroup.rotation.y = this.turretYaw - chassisEuler.y

      // Barrel tilt
      const elevAngle = Math.atan2(toPlayer.y, new THREE.Vector2(toPlayer.x, toPlayer.z).length())
      this.barrelGroup.rotation.x = THREE.MathUtils.clamp(-elevAngle, -0.4, 0.2)

      // Main gun
      if (dist < CANNON_RANGE && this.cannonCd <= 0) {
        this.cannonCd = CANNON_CD
        const muzzle  = pos.clone().add(new THREE.Vector3(0, 2.2, 0))
        const gunDir  = new THREE.Vector3().subVectors(playerPos, muzzle).normalize()
        this.fireMainGun(muzzle, gunDir)
        bus.emit('aiWeaponFired', { origin: muzzle, damage: CANNON_DMG, isTank: true })
      }

      // Coaxial MG
      if (dist < COAX_RANGE && this.coaxCd <= 0) {
        this.coaxCd = COAX_CD
        bus.emit('aiWeaponFired', { origin: pos, damage: COAX_DMG })
      }
    }

    // Update shells
    for (let i = this._shellsArr.length - 1; i >= 0; i--) {
      const s = this._shellsArr[i]
      if (!s) continue
      s.life -= dt
      s.pos.addScaledVector(s.vel, dt)
      s.mesh.position.copy(s.pos)

      const hit = s.pos.distanceTo(playerPos) < 2.5
      if (s.life <= 0 || hit) {
        if (hit) {
          bus.emit('blastDamage', {
            position: s.pos.clone(),
            radius: 5,
            damage: CANNON_DMG,
          })
          bus.emit('explosion', { position: s.pos.clone(), scale: 1.4 })
        }
        this.scene.remove(s.mesh)
        s.mesh.geometry.dispose()
        this._shellsArr.splice(i, 1)
      }
    }
  }

  dispose(): void {
    if (this.alive) {
      this.scene.remove(this.mesh)
      this.physics.world.removeBody(this.body)
    }
    for (const s of this._shellsArr) {
      this.scene.remove(s.mesh)
      s.mesh.geometry.dispose()
    }
    this._shellsArr.length = 0
  }
}
