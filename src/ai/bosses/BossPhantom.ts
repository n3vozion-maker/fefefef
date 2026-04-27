import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// ── BossPhantom — Mission 4 "Dead Drop" ──────────────────────────────────────
// Phantom-Zero: ghost operative / signal hacker, Dead Drop Zone.
//
// Phase 1 (HP > 40 %):  teleports 3–4 times per encounter, then fires SMG burst;
//                        EMP shockwave every 15 s (visual distort notice on HUD).
// Phase 2 (HP ≤ 40 %):  "PHANTOM FORKED" — deploys 1 hologram decoy (second mesh),
//                        teleports every 2 s, fires from unexpected angles,
//                        suicide drone launched every 10 s.

export class BossPhantom extends BossBase {
  private teleportTimer = 3
  private empTimer      = 15
  private droneTimer    = 0
  private decoyMesh:    THREE.Group | null = null
  private teleportCount = 0

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_phantom', [
      { healthThreshold: 0.40, abilities: ['teleport', 'smg', 'emp'],          speedMult: 1.0 },
      { healthThreshold: 0.00, abilities: ['teleport', 'smg', 'emp', 'drone'], speedMult: 1.3 },
    ], 650, spawnX, spawnZ, physics)
    this.bossName = 'PHANTOM-ZERO'
  }

  buildMesh(): THREE.Group {
    const g       = new THREE.Group()
    const bodyMat  = new THREE.MeshStandardMaterial({
      color: 0x001a33, roughness: 0.2, metalness: 0.9,
      transparent: true, opacity: 0.88,
    })
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff, emissive: new THREE.Color(0x00ccff), emissiveIntensity: 1.5,
    })
    const glowMat  = new THREE.MeshStandardMaterial({
      color: 0x002244,
      emissive: new THREE.Color(0x003366), emissiveIntensity: 0.8,
      roughness: 0.1, metalness: 1.0,
    })

    // Slim body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.85, 5, 8), bodyMat)
    body.castShadow = true
    g.add(body)

    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.1), visorMat)
    visor.position.set(0, 1.0, 0.25)
    g.add(visor)

    // Glowing edge strips (Tron-like)
    for (const [y, h] of [[0.4, 1.0], [-0.5, 0.3]] as [number, number][]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.32), glowMat)
      strip.position.set(0.31, y, 0)
      g.add(strip)
      const strip2 = strip.clone()
      strip2.position.x = -0.31
      g.add(strip2)
    }

    // Cyan point light
    const light = new THREE.PointLight(0x00ccff, 1.2, 6)
    light.position.set(0, 0.5, 0)
    g.add(light)

    return g
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    this.checkAggro(playerPos, 100)
    const dist = this.getPosition().distanceTo(playerPos)

    // ── Teleport ─────────────────────────────────────────────────────────────
    const teleportCD = this.phase === 1 ? 2.2 : 4.5
    this.teleportTimer -= dt
    if (this.teleportTimer <= 0) {
      this.teleport(playerPos)
      this.teleportTimer = teleportCD
      this.teleportCount++

      // After 2 teleports, fire SMG burst
      if (this.teleportCount >= 2) {
        this.teleportCount = 0
        if (this.fireTimer <= 0) {
          const shots    = this.phase === 1 ? 5 : 3
          for (let i = 0; i < shots; i++) {
            setTimeout(() => {
              if (!this.isDead()) this.shoot(playerPos, 22, 0.055)
            }, i * 85)
          }
          this.fireTimer = 0.9
        }
      }
    }

    // Slow close-in drift between teleports
    if (dist > 18) this.moveToward(playerPos, 2.5)

    // ── EMP shockwave ─────────────────────────────────────────────────────────
    this.empTimer -= dt
    if (this.empTimer <= 0 && dist < 30) {
      bus.emit('hudNotify', { msg: '⚡  EMP PULSE — SYSTEMS DISRUPTED', color: '#00ffff' })
      bus.emit('blastDamage', { position: this.getPosition().clone(), radius: 14, damage: 35 })
      this.empTimer = this.phase === 1 ? 10 : 15
    }

    // ── Suicide drone (phase 2) ───────────────────────────────────────────────
    if (this.phase === 1) {
      this.droneTimer -= dt
      if (this.droneTimer <= 0) {
        bus.emit('bossEvent', { id: this.id, event: 'drone',
          msg: 'PHANTOM: Drone deployed!' })
        // Emit a blast that arrives 3 s later at player position
        setTimeout(() => {
          if (!this.isDead()) {
            bus.emit('blastDamage', { position: playerPos.clone(), radius: 6, damage: 55 })
            bus.emit('explosion',   { position: playerPos.clone() })
          }
        }, 3000)
        this.droneTimer = 10
      }
    }

    // Move decoy mesh to confuse
    if (this.decoyMesh) {
      const t = Date.now() / 1000
      this.decoyMesh.position.set(
        this.body.position.x + Math.sin(t * 0.9) * 8,
        this.body.position.y,
        this.body.position.z + Math.cos(t * 0.7) * 8,
      )
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      bus.emit('bossEvent', { id: this.id, event: 'fork',
        msg: '⚠  PHANTOM FORKED — PHASE II' })
      bus.emit('bossMusic', { intensity: 'phase2' })
      this.spawnDecoy()
    }
  }

  private teleport(playerPos: THREE.Vector3): void {
    const angle = Math.random() * Math.PI * 2
    const r     = 12 + Math.random() * 18
    const nx    = playerPos.x + Math.cos(angle) * r
    const nz    = playerPos.z + Math.sin(angle) * r
    this.body.position.set(nx, this.body.position.y, nz)
    this.body.velocity.set(0, 0, 0)
  }

  private spawnDecoy(): void {
    if (!this.mesh) return
    const parent = (this.mesh as unknown as THREE.Object3D).parent
    if (!parent) return
    // Clone the group and add a blue tint to signal it's a fake
    this.decoyMesh = (this.mesh as unknown as THREE.Group).clone()
    this.decoyMesh.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        const m = o.material.clone()
        m.emissive    = new THREE.Color(0x002244)
        m.emissiveIntensity = 2.0
        m.opacity     = 0.55
        m.transparent = true
        o.material    = m
      }
    })
    parent.add(this.decoyMesh)
  }
}
