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
    const armyMat = new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.7 })
    const redMat  = new THREE.MeshStandardMaterial({ color: 0xcc1111, roughness: 0.5 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8a000, roughness: 0.4, metalness: 0.6 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })

    // Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 2.0, 6, 8), armyMat)
    body.castShadow = true
    g.add(body)

    // Red beret
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.12, 10), redMat)
    beret.position.set(0.08, 1.4, 0)
    beret.rotation.z = 0.15
    g.add(beret)

    // Gold rank star on shoulder
    const star = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), goldMat)
    star.position.set(0.5, 0.6, 0)
    g.add(star)

    // Rifle (dark box approximation)
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), darkMat)
    rifle.position.set(0.35, 0.2, 0.5)
    g.add(rifle)

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
