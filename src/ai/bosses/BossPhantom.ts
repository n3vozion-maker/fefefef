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
    const g        = new THREE.Group()
    const bodyMat  = new THREE.MeshStandardMaterial({
      color: 0x061a30, roughness: 0.2, metalness: 0.9,
      emissive: new THREE.Color(0x001122), emissiveIntensity: 0.5,
      transparent: true, opacity: 0.90,
    })
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff, emissive: new THREE.Color(0x00eeff), emissiveIntensity: 3.0,
    })
    const glowMat  = new THREE.MeshStandardMaterial({
      color: 0x0044aa,
      emissive: new THREE.Color(0x0055cc), emissiveIntensity: 2.0,
      roughness: 0.1, metalness: 1.0,
    })
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x0a2040, roughness: 0.3, metalness: 0.95,
      emissive: new THREE.Color(0x001833), emissiveIntensity: 0.4,
    })

    // Slim body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.95, 6, 10), bodyMat)
    body.castShadow = true; g.add(body)

    // Chest armour plate
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.70, 0.14), plateMat)
    chest.position.set(0, 0.35, 0.28); g.add(chest)

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), plateMat)
    head.position.set(0, 1.22, 0); head.castShadow = true; g.add(head)

    // Helmet top
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.18, 8), plateMat)
    helm.position.set(0, 1.36, 0); g.add(helm)

    // Wide visor — full-face screen look
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.10, 0.12), visorMat)
    visor.position.set(0, 1.18, 0.22); g.add(visor)

    // Secondary visor scan line
    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.09), visorMat)
    scanLine.position.set(0, 1.10, 0.22); g.add(scanLine)

    // Glowing edge strips (Tron-like) — both sides and front
    for (const [y, h] of [[0.4, 1.1], [-0.55, 0.35]] as [number, number][]) {
      for (const sx of [-0.33, 0.33]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.025, h, 0.35), glowMat)
        strip.position.set(sx, y, 0); g.add(strip)
      }
    }

    // Horizontal accent strips
    for (const sy of [0.8, 0.15, -0.35]) {
      const hstrip = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.025, 0.06), glowMat)
      hstrip.position.set(0, sy, 0.32); g.add(hstrip)
    }

    // Arms with glow trim
    for (const sx of [-0.42, 0.42]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.65, 4, 6), bodyMat)
      arm.position.set(sx, 0.28, 0); g.add(arm)
      const armStrip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.5, 0.025), glowMat)
      armStrip.position.set(sx, 0.28, 0.11); g.add(armStrip)
    }

    // Pistol / SMG in right hand
    const smg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.42), plateMat)
    smg.position.set(0.38, 0.05, 0.22); g.add(smg)

    // Strong cyan point light — main glow
    const light = new THREE.PointLight(0x00ccff, 2.8, 12)
    light.position.set(0, 0.5, 0); g.add(light)

    // Secondary visor light
    const visorLight = new THREE.PointLight(0x00ffff, 1.2, 4)
    visorLight.position.set(0, 1.18, 0.4); g.add(visorLight)

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
