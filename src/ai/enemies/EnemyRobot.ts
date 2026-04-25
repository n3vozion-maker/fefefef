import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { bus }     from '../../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const HP              = 180
const MELEE_R         = 2.5
const MELEE_DMG       = 35
const MELEE_CD        = 0.9
const ROCKET_R        = 30
const ROCKET_SPEED    = 24
const ROCKET_CD       = 5.0
const ROCKET_BLAST_R  = 6
const ROCKET_BLAST_DMG = 80
const MOVE_SPEED      = 6.5
const AGGRO_R         = 60

// ── EnemyRobot (Titanfall grunt — fast melee + shoulder rocket) ───────────────

export class EnemyRobot {
  body:   CANNON.Body
  mesh:   THREE.Group
  hp      = HP
  alive   = true

  private meleeCd  = 0
  private rocketCd = 0
  private rockets: Array<{
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
    const shape = new CANNON.Cylinder(0.4, 0.4, 1.7, 8)
    this.body   = new CANNON.Body({ mass: 110, linearDamping: 0.95, angularDamping: 1 })
    this.body.addShape(shape)
    this.body.position.set(wx, 5, wz)
    ;(this.body as unknown as Record<string,unknown>).agentId = `robot_${wx}_${wz}`
    ;(this.body as unknown as Record<string,unknown>).armour  = 15
    ;(this.body as unknown as Record<string,unknown>).onDamage = (dmg: number) => this.applyDamage(dmg)
    physics.world.addBody(this.body)

    // Mesh: boxy metallic robot
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.4, metalness: 0.7 }),
    )
    torso.position.y = 0.3
    torso.castShadow = true

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3a5060, roughness: 0.5, metalness: 0.8 }),
    )
    head.position.y = 1.0
    head.castShadow = true

    // Eye glows
    const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 })
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat)
    const eyeR   = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-0.1, 1.02, 0.21)
    eyeR.position.set( 0.1, 1.02, 0.21)

    // Rocket launcher shoulder pod
    const rocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.9 }),
    )
    rocket.rotation.z = Math.PI / 2
    rocket.position.set(0.55, 0.65, 0)
    rocket.castShadow = true

    this.mesh = new THREE.Group()
    this.mesh.add(torso, head, eyeL, eyeR, rocket)
    scene.add(this.mesh)
  }

  applyDamage(dmg: number): void {
    if (!this.alive) return
    this.hp -= dmg
    if (this.hp <= 0) this.die()
  }

  private die(): void {
    this.alive = false
    this.scene.remove(this.mesh)
    this.physics.world.removeBody(this.body)
    bus.emit('agentDied', { agentId: (this.body as unknown as Record<string,unknown>).agentId })
    // Death explosion
    bus.emit('blastDamage', {
      position: new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z),
      radius: 3,
      damage: 30,
    })
  }

  private fireRocket(from: THREE.Vector3, toward: THREE.Vector3): void {
    const vel = toward.clone().normalize().multiplyScalar(ROCKET_SPEED)
    const geo  = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(from)
    this.scene.add(mesh)
    this.rockets.push({ pos: from.clone(), vel, mesh, life: 4 })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.alive) return

    const pos = new THREE.Vector3(
      this.body.position.x, this.body.position.y, this.body.position.z,
    )
    this.mesh.position.copy(pos)

    const dist = pos.distanceTo(playerPos)

    this.meleeCd  -= dt
    this.rocketCd -= dt

    if (dist < AGGRO_R) {
      // Move toward player
      const dir = new THREE.Vector3().subVectors(playerPos, pos).setY(0).normalize()
      this.body.velocity.set(
        dir.x * MOVE_SPEED,
        this.body.velocity.y,
        dir.z * MOVE_SPEED,
      )

      // Face player
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z)

      // Melee
      if (dist < MELEE_R && this.meleeCd <= 0) {
        this.meleeCd = MELEE_CD
        bus.emit('aiWeaponFired', { origin: pos, damage: MELEE_DMG })
      }

      // Rocket (mid-range)
      if (dist > MELEE_R && dist < ROCKET_R && this.rocketCd <= 0) {
        this.rocketCd = ROCKET_CD
        const muzzle = pos.clone().add(new THREE.Vector3(0.55, 0.65, 0))
        this.fireRocket(muzzle, new THREE.Vector3().subVectors(playerPos, muzzle))
      }
    } else {
      // Slow down
      this.body.velocity.set(
        this.body.velocity.x * 0.85,
        this.body.velocity.y,
        this.body.velocity.z * 0.85,
      )
    }

    // Update rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]
      if (!r) continue
      r.life -= dt
      r.pos.addScaledVector(r.vel, dt)
      r.mesh.position.copy(r.pos)

      const hit = r.pos.distanceTo(playerPos) < 2.0

      if (r.life <= 0 || hit) {
        // Explode
        bus.emit('blastDamage', {
          position: r.pos.clone(),
          radius:   ROCKET_BLAST_R,
          damage:   ROCKET_BLAST_DMG,
        })
        bus.emit('explosion', { position: r.pos.clone(), scale: 1.2 })
        this.scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        this.rockets.splice(i, 1)
      }
    }
  }

  dispose(): void {
    if (this.alive) {
      this.scene.remove(this.mesh)
      this.physics.world.removeBody(this.body)
    }
    for (const r of this.rockets) {
      this.scene.remove(r.mesh)
      r.mesh.geometry.dispose()
    }
    this.rockets.length = 0
  }
}
