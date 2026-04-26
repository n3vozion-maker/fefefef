import * as THREE from 'three'
import { bus }    from '../../core/EventBus'

// ── Constants ─────────────────────────────────────────────────────────────────

const HP              = 80
const FLY_HEIGHT      = 18       // metres above terrain
const PATROL_SPEED    = 7
const CHASE_SPEED     = 11
const AGGRO_R         = 90
const ROCKET_R        = 55
const ROCKET_CD       = 3.5
const ROCKET_SPEED    = 22
const ROCKET_BLAST_R  = 5
const ROCKET_BLAST_DMG = 60
const HOVER_BOB       = 0.8      // amplitude of vertical hover
const HOVER_FREQ      = 1.2

// ── EnemyDrone ────────────────────────────────────────────────────────────────

export class EnemyDrone {
  mesh:   THREE.Group
  hp      = HP
  alive   = true

  private pos       = new THREE.Vector3()
  private vel       = new THREE.Vector3()
  private rocketCd  = ROCKET_CD * Math.random()
  private hoverT    = Math.random() * Math.PI * 2
  private rockets: Array<{
    pos: THREE.Vector3
    vel: THREE.Vector3
    mesh: THREE.Mesh
    life: number
  }> = []

  constructor(
    wx: number, wz: number, wy: number,
    private scene: THREE.Scene,
  ) {
    this.pos.set(wx, wy + FLY_HEIGHT, wz)

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.4, metalness: 0.8 }),
    )
    body.castShadow = true

    // 4 rotor arms
    const armMat  = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5 })
    const propMat = new THREE.MeshBasicMaterial({ color: 0x888899, transparent: true, opacity: 0.55 })

    this.mesh = new THREE.Group()
    this.mesh.add(body)

    for (let i = 0; i < 4; i++) {
      const angle  = (i / 4) * Math.PI * 2 + Math.PI / 4
      const arm    = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.1), armMat)
      arm.position.set(Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55)
      arm.rotation.y = angle

      const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 8), propMat)
      prop.position.copy(arm.position)
      prop.position.y = 0.07

      this.mesh.add(arm, prop)
    }

    // Rocket pod underneath
    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.18, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.9 }),
    )
    pod.position.set(0, -0.2, 0)
    this.mesh.add(pod)

    // Eye light
    const eyeLight = new THREE.PointLight(0xff2200, 1.2, 6)
    eyeLight.position.set(0, -0.12, 0.46)
    this.mesh.add(eyeLight)

    this.mesh.position.copy(this.pos)
    scene.add(this.mesh)
  }

  applyDamage(dmg: number): void {
    if (!this.alive) return
    this.hp -= dmg
    if (this.hp <= 0) this.die()
  }

  private die(): void {
    this.alive = false
    bus.emit('blastDamage', {
      position: this.pos.clone(),
      radius: 4,
      damage: 40,
    })
    bus.emit('explosion', { position: this.pos.clone(), scale: 0.9 })
    this.scene.remove(this.mesh)
    bus.emit('agentDied', { agentId: `drone_${this.pos.x}_${this.pos.z}` })
  }

  private fireRocket(toward: THREE.Vector3): void {
    const vel  = toward.clone().normalize().multiplyScalar(ROCKET_SPEED)
    const geo  = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff8800 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(this.pos).add(new THREE.Vector3(0, -0.3, 0))
    this.scene.add(mesh)
    this.rockets.push({ pos: mesh.position.clone(), vel, mesh, life: 5 })
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.alive) return

    this.hoverT    += dt * HOVER_FREQ
    this.rocketCd  -= dt

    const dist  = this.pos.distanceTo(playerPos)
    const inAggro = dist < AGGRO_R

    // Movement
    if (inAggro) {
      // Chase at constant altitude above player
      const target = new THREE.Vector3(playerPos.x, playerPos.y + FLY_HEIGHT, playerPos.z)
      const dir    = new THREE.Vector3().subVectors(target, this.pos)
      const hDist  = new THREE.Vector2(dir.x, dir.z).length()

      if (hDist > 3) {
        dir.y = 0
        dir.normalize().multiplyScalar(CHASE_SPEED)
        this.vel.lerp(dir, dt * 3)
      } else {
        this.vel.multiplyScalar(0.9)
      }
    } else {
      // Slow patrol bob in place
      this.vel.multiplyScalar(0.92)
    }

    // Hover oscillation
    this.pos.addScaledVector(this.vel, dt)
    this.pos.y += Math.sin(this.hoverT) * HOVER_BOB * dt

    this.mesh.position.copy(this.pos)
    // Tilt in move direction
    this.mesh.rotation.x = -this.vel.z * 0.04
    this.mesh.rotation.z =  this.vel.x * 0.04

    // Rocket fire
    if (inAggro && dist < ROCKET_R && this.rocketCd <= 0) {
      this.rocketCd = ROCKET_CD
      const toward = new THREE.Vector3().subVectors(playerPos, this.pos)
      this.fireRocket(toward)
    }

    // Update rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]
      if (!r) continue
      r.life -= dt
      r.pos.addScaledVector(r.vel, dt)
      r.mesh.position.copy(r.pos)

      const hit = r.pos.distanceTo(playerPos) < 1.8

      if (r.life <= 0 || hit) {
        bus.emit('blastDamage', {
          position: r.pos.clone(),
          radius:   ROCKET_BLAST_R,
          damage:   ROCKET_BLAST_DMG,
        })
        bus.emit('explosion', { position: r.pos.clone(), scale: 0.8 })
        this.scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        this.rockets.splice(i, 1)
      }
    }
  }

  dispose(): void {
    if (this.alive) this.scene.remove(this.mesh)
    for (const r of this.rockets) {
      this.scene.remove(r.mesh)
      r.mesh.geometry.dispose()
    }
    this.rockets.length = 0
  }

  getPosition(): THREE.Vector3 { return this.pos.clone() }
}
