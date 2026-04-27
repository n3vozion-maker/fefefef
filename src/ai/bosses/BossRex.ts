import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// ── BossRex — Mission 5 "Deep Facility" ──────────────────────────────────────
// General Rex: supreme commander, 3-phase final boss, Deep Facility.
//
// Phase 1 (HP > 60 %):  armoured exo-suit (40 % dmg reduction), heavy cannon
//                        every 3.5 s, summons 4 robot-like soldiers every 25 s.
// Phase 2 (HP ≤ 60 %):  "EXO COMPROMISED" — armour torn off (explosion),
//                        airstrike beacon every 8 s (3 s warning → triple blast),
//                        speed × 1.5, rapid fire short-range burst.
// Phase 3 (HP ≤ 25 %):  "GENERAL REX UNLEASHED" — all attacks active,
//                        continuous minigun, airstrike every 4 s, speed × 2.2,
//                        shockwave stomp every 3 s. Red glow on mesh.

const CANNON_DMG  = 120
const AIRSTRIKE_R = 10

export class BossRex extends BossBase {
  private cannonTimer    = 1
  private reinforceTimer = 25
  private airstrikeTimer = 0
  private stompTimer     = 0
  private exoMeshes:     THREE.Mesh[] = []
  private innerMesh:     THREE.Group | null = null

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_rex', [
      { healthThreshold: 0.60, abilities: ['cannon', 'reinforce'],                   speedMult: 0.9 },
      { healthThreshold: 0.25, abilities: ['cannon', 'reinforce', 'airstrike'],      speedMult: 1.5 },
      { healthThreshold: 0.00, abilities: ['cannon', 'reinforce', 'airstrike', 'stomp', 'minigun'], speedMult: 2.2 },
    ], 3500, spawnX, spawnZ, physics)
    this.bossName = 'GENERAL REX'
    ;(this.body as unknown as Record<string, unknown>)['armour'] = 40
  }

  buildMesh(): THREE.Group {
    const g = new THREE.Group()

    // ── Exo-armour shell (phase 1 only) ──────────────────────────────────────
    const exoMat  = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.4, metalness: 0.7 })
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.5, metalness: 0.6 })

    const exoTorso = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.5, 1.4), exoMat)
    exoTorso.castShadow = true
    g.add(exoTorso)
    this.exoMeshes.push(exoTorso)

    // Chest plate
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.4, 0.28), plateMat)
    chest.position.set(0, 0, 0.85)
    chest.castShadow = true
    g.add(chest)
    this.exoMeshes.push(chest)

    // Shoulder pads
    for (const sx of [-1.3, 1.3]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.9), plateMat)
      pad.position.set(sx, 0.9, 0)
      pad.castShadow = true
      g.add(pad)
      this.exoMeshes.push(pad)
    }

    // Helmet
    const helm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.85), exoMat)
    helm.position.set(0, 1.85, 0)
    helm.castShadow = true
    g.add(helm)
    this.exoMeshes.push(helm)

    // Visor slit (gold)
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xcc8800, emissive: new THREE.Color(0xaa6600), emissiveIntensity: 1.0 })
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), goldMat)
    visor.position.set(0, 1.85, 0.44)
    g.add(visor)

    // Cannon arm
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 })
    const arm  = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 1.8), darkMat)
    arm.position.set(1.2, 0.3, 0.9)
    arm.castShadow = true
    g.add(arm)
    this.exoMeshes.push(arm)

    // ── Inner body (revealed in phase 2+) ────────────────────────────────────
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 0.7 })
    const inner    = new THREE.Group()
    const innerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.2, 6, 8), innerMat)
    innerBody.castShadow = true
    inner.add(innerBody)
    inner.visible = false
    g.add(inner)
    this.innerMesh = inner

    return g
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    this.checkAggro(playerPos, 120)
    const dist  = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // Movement
    if (dist > 14) this.moveToward(playerPos, 4 * phase.speedMult)

    // ── Heavy cannon ────────────────────────────────────────────────────────
    this.cannonTimer -= dt
    if (this.cannonTimer <= 0 && dist < 70) {
      const shots = this.phase === 2 ? 4 : 1
      for (let i = 0; i < shots; i++) {
        setTimeout(() => {
          if (!this.isDead()) this.shoot(playerPos, CANNON_DMG / shots, 0.025)
        }, i * 150)
      }
      this.cannonTimer = this.phase === 0 ? 3.5 : this.phase === 1 ? 2.0 : 0.9
    }

    // ── Reinforce ────────────────────────────────────────────────────────────
    this.reinforceTimer -= dt
    if (this.reinforceTimer <= 0) {
      const count = this.phase === 2 ? 6 : 4
      bus.emit('bossReinforce', { origin: this.getPosition().clone(), count })
      bus.emit('bossEvent', { id: this.id, event: 'reinforce',
        msg: `REX: "All units — CONVERGE!"` })
      this.reinforceTimer = this.phase === 2 ? 15 : 25
    }

    // ── Airstrike (phases 1+) ────────────────────────────────────────────────
    if (this.phase >= 1) {
      this.airstrikeTimer -= dt
      if (this.airstrikeTimer <= 0 && dist < 80) {
        const target = playerPos.clone()
        bus.emit('hudNotify', { msg: '⚠  INCOMING AIRSTRIKE', color: '#ff4400' })
        bus.emit('bossEvent', { id: this.id, event: 'airstrike', msg: 'REX: "Mark acquired. Fire!"' })
        setTimeout(() => {
          if (!this.isDead()) {
            for (let i = 0; i < 3; i++) {
              setTimeout(() => {
                const p = target.clone().add(new THREE.Vector3((Math.random()-0.5)*12, 0, (Math.random()-0.5)*12))
                bus.emit('blastDamage', { position: p, radius: AIRSTRIKE_R, damage: 100 })
                bus.emit('explosion',   { position: p })
              }, i * 350)
            }
          }
        }, 3000)
        this.airstrikeTimer = this.phase === 2 ? 4 : 8
      }
    }

    // ── Stomp shockwave (phase 2 only) ────────────────────────────────────────
    if (this.phase === 2) {
      this.stompTimer -= dt
      if (this.stompTimer <= 0) {
        bus.emit('blastDamage', { position: this.getPosition().clone(), radius: 10, damage: 70 })
        bus.emit('bossEvent', { id: this.id, event: 'stomp', msg: '🔴 REX STOMP' })
        this.stompTimer = 3
      }
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      // Strip exo-armour
      ;(this.body as unknown as Record<string, unknown>)['armour'] = 0
      if (this.mesh) {
        for (const em of this.exoMeshes) {
          (this.mesh as unknown as THREE.Group).remove(em)
        }
        if (this.innerMesh) this.innerMesh.visible = true
      }
      bus.emit('explosion', { position: this.getPosition().clone() })
      bus.emit('blastDamage', { position: this.getPosition().clone(), radius: 8, damage: 50 })
      bus.emit('bossEvent', { id: this.id, event: 'phase2',
        msg: '⚠  REX EXO COMPROMISED — PHASE II' })
      bus.emit('bossMusic', { intensity: 'phase2' })
    }

    if (newPhase === 2) {
      // Turn inner mesh red-glowing
      if (this.innerMesh) {
        this.innerMesh.traverse(o => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
            o.material = o.material.clone()
            o.material.emissive          = new THREE.Color(0xcc0000)
            o.material.emissiveIntensity = 1.5
          }
        })
      }
      bus.emit('bossEvent', { id: this.id, event: 'phase3',
        msg: '🔴🔴  GENERAL REX UNLEASHED — FINAL PHASE' })
      bus.emit('bossMusic', { intensity: 'phase3' })
    }
  }
}
