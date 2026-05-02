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

    // ── Materials ─────────────────────────────────────────────────────────────
    const exoMat   = new THREE.MeshStandardMaterial({ color: 0x2a1200, roughness: 0.4, metalness: 0.75, emissive: new THREE.Color(0x0e0500), emissiveIntensity: 0.4 })
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.45, metalness: 0.65, emissive: new THREE.Color(0x550000), emissiveIntensity: 0.6 })
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.85, emissive: new THREE.Color(0x060606), emissiveIntensity: 0.3 })
    const goldMat  = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: new THREE.Color(0xdd7700), emissiveIntensity: 2.5, roughness: 0.2, metalness: 0.8 })

    // ── Exo-armour shell (phase 1 only) ──────────────────────────────────────

    const exoTorso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.7, 1.5), exoMat)
    exoTorso.castShadow = true; g.add(exoTorso)
    this.exoMeshes.push(exoTorso)

    // Chest plate with embossed detail
    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.6, 0.30), plateMat)
    chest.position.set(0, 0, 0.92); chest.castShadow = true; g.add(chest)
    this.exoMeshes.push(chest)

    // Chest emblem (golden star-like shape)
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.06), goldMat)
    emblem.position.set(0, 0.4, 1.24); g.add(emblem)

    // Shoulder pads — massive
    for (const sx of [-1.4, 1.4]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.68, 1.0), plateMat)
      pad.position.set(sx, 1.0, 0); pad.castShadow = true; g.add(pad)
      this.exoMeshes.push(pad)
      // Shoulder spike
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), exoMat)
      spike.position.set(sx, 1.42, 0); g.add(spike)
      this.exoMeshes.push(spike)
    }

    // Exo legs — armoured
    for (const sx of [-0.7, 0.7]) {
      const legUpper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.1, 0.62), exoMat)
      legUpper.position.set(sx, -1.55, 0); legUpper.castShadow = true; g.add(legUpper)
      this.exoMeshes.push(legUpper)
      const legLower = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.90, 0.54), darkMat)
      legLower.position.set(sx, -2.45, 0); legLower.castShadow = true; g.add(legLower)
      this.exoMeshes.push(legLower)
    }

    // Helmet — large, imposing
    const helm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.88, 0.95), exoMat)
    helm.position.set(0, 2.0, 0); helm.castShadow = true; g.add(helm)
    this.exoMeshes.push(helm)

    // Visor slit (gold) — wide
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.12), goldMat)
    visor.position.set(0, 2.0, 0.50); g.add(visor)

    // Cannon arm (right)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.40, 2.0), darkMat)
    arm.position.set(1.3, 0.35, 1.0); arm.castShadow = true; g.add(arm)
    this.exoMeshes.push(arm)

    // Cannon barrel
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.9 })
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.8, 8), barrelMat)
    barrel.rotation.x = Math.PI / 2; barrel.position.set(1.3, 0.35, 1.9); g.add(barrel)
    this.exoMeshes.push(barrel)

    // ── Inner body (revealed in phase 2+) ────────────────────────────────────
    const innerMat  = new THREE.MeshStandardMaterial({ color: 0x4a1818, roughness: 0.65, emissive: new THREE.Color(0x200808), emissiveIntensity: 0.5 })
    const inner     = new THREE.Group()
    const innerBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.4, 6, 8), innerMat)
    innerBody.castShadow = true; inner.add(innerBody)

    // Inner glowing red eyes
    const innerEyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: new THREE.Color(0xff0000), emissiveIntensity: 3.5 })
    for (const ex of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 6), innerEyeMat)
      eye.position.set(ex, 1.45, 0.48); inner.add(eye)
    }

    inner.visible = false; g.add(inner)
    this.innerMesh = inner

    // ── Lights ────────────────────────────────────────────────────────────────
    // Gold visor glow
    const visorLight = new THREE.PointLight(0xffaa00, 2.5, 10)
    visorLight.position.set(0, 2.0, 0.7); g.add(visorLight)

    // Red under-glow for menace
    const redLight = new THREE.PointLight(0xff2200, 1.8, 12)
    redLight.position.set(0, -0.5, 0.5); g.add(redLight)

    g.scale.setScalar(1.15)   // final boss — biggest presence
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
