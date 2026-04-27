import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// ── BossWraith — Mission 2 "Ghost Town" ───────────────────────────────────────
// The Wraith: rogue stealth operative, Northern Ruins.
//
// Phase 1 (HP > 45 %):  long-range sniper shots (high dmg, 2.2 s windup laser),
//                        repositions after every shot, retreats if player closes in.
// Phase 2 (HP ≤ 45 %):  "WRAITH IS CLOAKING" — mesh goes translucent (opacity 0.25),
//                        teleports every 4 s, fires 4-shot SMG burst, melee rush
//                        at ≤4 m (60 dmg punch + knockback).

const AGGRO_R    = 120
const LASER_LIFE = 2.2    // s windup before sniper shot
const MELEE_R    = 4.5

export class BossWraith extends BossBase {
  private shotTimer    = 2
  private laserLine:   THREE.Line | null = null
  private teleportTimer = 0
  private cloaked      = false

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_wraith', [
      { healthThreshold: 0.45, abilities: ['snipe', 'reposition'], speedMult: 3.5 },
      { healthThreshold: 0.00, abilities: ['snipe', 'smg', 'melee', 'cloak'],  speedMult: 5.0 },
    ], 600, spawnX, spawnZ, physics)
    this.bossName = 'THE WRAITH'
  }

  buildMesh(): THREE.Group {
    const g       = new THREE.Group()
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.9 })
    const visorMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: new THREE.Color(0xff0000), emissiveIntensity: 1.2, roughness: 0.3 })

    // Slim body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.9, 5, 8), darkMat)
    body.castShadow = true
    g.add(body)

    // Hood (dark flattened half-sphere)
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), darkMat)
    hood.position.set(0, 1.25, 0.05)
    g.add(hood)

    // Red glowing visor slit
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), visorMat)
    visor.position.set(0, 1.0, 0.26)
    g.add(visor)

    // Point light for ambient glow (red eye)
    const light = new THREE.PointLight(0xff0000, 0.8, 4)
    light.position.set(0, 1.0, 0.3)
    g.add(light)

    return g
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    this.checkAggro(playerPos, AGGRO_R)
    const dist  = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // ── Phase 2: teleport every 4 s ─────────────────────────────────────────
    if (this.phase === 1) {
      this.teleportTimer -= dt
      if (this.teleportTimer <= 0) {
        this.teleport(playerPos)
        this.teleportTimer = 4
      }
    }

    // ── Movement ─────────────────────────────────────────────────────────────
    if (this.phase === 0) {
      // Phase 1: keep sniping distance, back away if too close
      if (dist < 35) this.moveToward(playerPos, -phase.speedMult)
      else if (dist > 70) this.moveToward(playerPos, phase.speedMult)
    }

    // ── Sniper shot ──────────────────────────────────────────────────────────
    this.shotTimer -= dt
    if (this.shotTimer <= 0 && dist < 90) {
      if (this.laserLine === null) {
        this.spawnLaser(playerPos)
        // After windup → fire
        setTimeout(() => {
          if (!this.isDead()) {
            this.shoot(playerPos, 70, 0.01)   // precise, high damage
            this.removeLaser()
            // Reposition after shot
            this.teleport(playerPos)
          }
        }, LASER_LIFE * 1000)
      }
      this.shotTimer = this.phase === 1 ? 3.5 : 5.5
    }

    // ── Phase 2: SMG burst ────────────────────────────────────────────────────
    if (this.phase === 1 && this.fireTimer <= 0 && dist < 25) {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (!this.isDead()) this.shoot(playerPos, 20, 0.07)
        }, i * 80)
      }
      this.fireTimer = 1.2
    }

    // ── Phase 2: melee rush ──────────────────────────────────────────────────
    if (this.phase === 1 && dist < MELEE_R) {
      this.moveToward(playerPos, phase.speedMult)
      if (this.fireTimer <= 0) {
        bus.emit('aiWeaponFired', {
          agentId:   this.id,
          origin:    this.getPosition(),
          direction: playerPos.clone().sub(this.getPosition()).normalize(),
          damage:    60,
        })
        this.fireTimer = 1.0
        bus.emit('bossEvent', { id: this.id, event: 'melee', msg: 'The Wraith strikes!' })
      }
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      this.cloaked = true
      if (this.mesh) {
        this.mesh.traverse(o => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
            o.material = o.material.clone()
            o.material.transparent = true
            o.material.opacity     = 0.25
          }
        })
      }
      bus.emit('bossEvent', { id: this.id, event: 'cloak',
        msg: '⚠  WRAITH IS CLOAKING — PHASE II' })
      bus.emit('bossMusic', { intensity: 'phase2' })
    }
  }

  private teleport(playerPos: THREE.Vector3): void {
    const angle = Math.random() * Math.PI * 2
    const r     = 18 + Math.random() * 20
    const nx    = playerPos.x + Math.cos(angle) * r
    const nz    = playerPos.z + Math.sin(angle) * r
    this.body.position.set(nx, this.body.position.y, nz)
    this.body.velocity.set(0, 0, 0)
    bus.emit('explosion', { position: this.getPosition().clone() })   // teleport "pop"
  }

  private spawnLaser(playerPos: THREE.Vector3): void {
    const points = [
      this.getPosition().clone().add(new THREE.Vector3(0, 0.8, 0)),
      playerPos.clone(),
    ]
    const geo  = new THREE.BufferGeometry().setFromPoints(points)
    const mat  = new THREE.LineBasicMaterial({ color: 0xff0000 })
    this.laserLine = new THREE.Line(geo, mat)
    ;(this.mesh as unknown as THREE.Group | null)?.parent?.add(this.laserLine)
  }

  private removeLaser(): void {
    if (!this.laserLine) return
    this.laserLine.parent?.remove(this.laserLine)
    this.laserLine.geometry.dispose()
    this.laserLine = null
  }
}
