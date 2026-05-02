import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// ── BossVoss — Mission 1 "First Contact" ──────────────────────────────────────
// Colonel Voss: veteran military commander, Firebase Alpha.
//
// Phase 1 (HP > 50 %):  burst-fire rifle, calls 3 soldiers every 20 s,
//                        retreats to medium range, occasional grenade lob.
// Phase 2 (HP ≤ 50 %):  "VOSS HAS GONE DARK" — smoke screen (visual only),
//                        doubled fire rate, calls 5 soldiers every 12 s,
//                        rocket salvo every 8 s, speed × 1.6.

export class BossVoss extends BossBase {
  private grenadeTimer   = 4
  private reinforceTimer = 20
  private rocketTimer    = 0

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_alpha', [
      { healthThreshold: 0.50, abilities: ['burst', 'grenade', 'reinforce'], speedMult: 1.0 },
      { healthThreshold: 0.00, abilities: ['burst', 'grenade', 'reinforce', 'rocket'], speedMult: 1.6 },
    ], 900, spawnX, spawnZ, physics)
    this.bossName = 'COLONEL VOSS'
  }

  // ── Mesh ─────────────────────────────────────────────────────────────────

  buildMesh(): THREE.Group {
    const g       = new THREE.Group()
    const armyMat = new THREE.MeshStandardMaterial({ color: 0x3a5022, roughness: 0.7, emissive: new THREE.Color(0x0a1408), emissiveIntensity: 0.4 })
    const redMat  = new THREE.MeshStandardMaterial({ color: 0xee1111, roughness: 0.5, emissive: new THREE.Color(0x880000), emissiveIntensity: 0.6 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a800, roughness: 0.3, metalness: 0.7, emissive: new THREE.Color(0x604000), emissiveIntensity: 0.5 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc08060, roughness: 0.8 })

    // Large imposing body (1.8× scale)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.6, 6, 10), armyMat)
    body.castShadow = true; g.add(body)

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), skinMat)
    head.position.set(0, 1.82, 0); head.castShadow = true; g.add(head)

    // Red beret — large, tilted
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.14, 10), redMat)
    beret.position.set(0.10, 2.02, 0); beret.rotation.z = 0.18; g.add(beret)

    // Heavy body armour plates
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.80, 0.30), darkMat)
    chest.position.set(0, 0.85, 0.18); g.add(chest)

    // Gold shoulder bars (both sides)
    for (const sx of [-0.66, 0.66]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.08, 0.38), goldMat)
      bar.position.set(sx, 1.1, 0); g.add(bar)
    }

    // Arms
    for (const sx of [-0.75, 0.75]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.7, 4, 6), armyMat)
      arm.position.set(sx, 0.4, 0); arm.rotation.z = sx > 0 ? -0.3 : 0.3
      arm.castShadow = true; g.add(arm)
    }

    // Legs
    for (const lx of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 4, 6), darkMat)
      leg.position.set(lx, -1.1, 0); leg.castShadow = true; g.add(leg)
    }

    // Assault rifle
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 1.1), darkMat)
    rifle.position.set(0.45, 0.3, 0.5); g.add(rifle)
    const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), darkMat)
    barrel2.rotation.x = Math.PI / 2; barrel2.position.set(0.45, 0.3, -0.05); g.add(barrel2)

    // Glowing rank insignia on chest
    const insig = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.04), goldMat)
    insig.position.set(0, 1.0, 0.34); g.add(insig)

    g.scale.setScalar(1.0)   // already scaled in geometry
    return g
  }

  // ── Behaviour ─────────────────────────────────────────────────────────────

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    this.checkAggro(playerPos, 90)
    const dist  = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // Movement — stay at 12-30 m
    if (dist > 28)      this.moveToward(playerPos, 4.5 * phase.speedMult)
    else if (dist < 12) this.moveToward(playerPos, -3 * phase.speedMult)  // back away

    // ── Burst fire ──────────────────────────────────────────────────────────
    if (this.fireTimer <= 0 && dist < 45) {
      const bursts   = this.phase === 1 ? 5 : 3
      const interval = this.phase === 1 ? 60  : 90    // ms
      for (let i = 0; i < bursts; i++) {
        setTimeout(() => {
          if (!this.isDead()) this.shoot(playerPos, 18 + this.phase * 7, 0.04)
        }, i * interval)
      }
      this.fireTimer = this.phase === 1 ? 0.7 : 1.4
    }

    // ── Grenade lob ──────────────────────────────────────────────────────────
    this.grenadeTimer -= dt
    if (this.grenadeTimer <= 0 && dist < 35) {
      bus.emit('grenadeThrown', {
        origin:  this.getPosition().clone().add(new THREE.Vector3(0, 1.2, 0)),
        target:  playerPos.clone(),
        damage:  55,
        radius:  6,
        agentId: this.id,
      })
      this.grenadeTimer = this.phase === 1 ? 5 : 9
    }

    // ── Reinforce call ───────────────────────────────────────────────────────
    this.reinforceTimer -= dt
    if (this.reinforceTimer <= 0) {
      const count = this.phase === 1 ? 5 : 3
      bus.emit('bossReinforce', { origin: this.getPosition().clone(), count })
      bus.emit('bossEvent', { id: this.id, event: 'reinforce',
        msg: `VOSS: "Backup — now! ${count} to my position!"` })
      this.reinforceTimer = this.phase === 1 ? 12 : 20
    }

    // ── Rocket salvo (phase 2 only) ───────────────────────────────────────────
    if (this.phase === 1) {
      this.rocketTimer -= dt
      if (this.rocketTimer <= 0 && dist < 55) {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!this.isDead()) {
              bus.emit('blastDamage', {
                position: playerPos.clone().add(new THREE.Vector3(
                  (Math.random()-0.5)*6, 0, (Math.random()-0.5)*6)),
                radius: 7, damage: 65,
              })
              bus.emit('explosion', { position: playerPos.clone() })
            }
          }, i * 700)
        }
        this.rocketTimer = 8
        bus.emit('bossEvent', { id: this.id, event: 'rockets',
          msg: 'VOSS: "Fire for effect!"' })
      }
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      bus.emit('bossEvent', { id: this.id, event: 'phase2',
        msg: '⚠  VOSS HAS GONE DARK — PHASE II' })
      bus.emit('bossMusic', { intensity: 'phase2' })
    }
  }
}
