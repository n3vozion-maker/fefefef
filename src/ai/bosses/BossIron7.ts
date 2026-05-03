import * as THREE  from 'three'
import { BossBase } from './BossBase'
import type { PhysicsWorld } from '../../physics/PhysicsWorld'
import { bus } from '../../core/EventBus'

// ── BossIron7 — Mission 3 "Heavy Metal" ──────────────────────────────────────
// IRON-7 Juggernaut: walking weapons platform, Firebase Bravo.
//
// Phase 1 (HP > 40 %):  heavy front armour (60 % damage reduction),
//                        minigun sweep (rapid spread shots), ground-stomp shockwave.
// Phase 2 (HP ≤ 40 %):  "ARMOUR BREACH" — outer armour explodes off (blast),
//                        no damage reduction, rocket salvo every 6 s,
//                        enraged charge (speed × 2 for 1.5 s), speed × 1.4.

const STOMP_R  = 8    // shockwave radius
const STOMP_DMG = 55
const CHARGE_SPD = 22
const CHARGE_DUR = 1.5

export class BossIron7 extends BossBase {
  protected override footDepth = 2.0   // juggernaut legs are shorter but bulky

  private stompTimer  = 5
  private rocketTimer = 0
  private chargeTimer = 0
  private isCharging  = false
  private chargeEnd   = 0
  private chargeDir   = new THREE.Vector3()
  private armourMeshes: THREE.Mesh[] = []

  constructor(spawnX: number, spawnZ: number, physics: PhysicsWorld) {
    super('boss_heavy', [
      { healthThreshold: 0.40, abilities: ['minigun', 'stomp'],               speedMult: 0.7 },
      { healthThreshold: 0.00, abilities: ['minigun', 'stomp', 'rocket', 'charge'], speedMult: 1.4 },
    ], 2200, spawnX, spawnZ, physics)
    this.bossName = 'IRON-7 JUGGERNAUT'
    // Tag body with front-armour
    ;(this.body as unknown as Record<string, unknown>)['armour'] = 60
  }

  buildMesh(): THREE.Group {
    const g        = new THREE.Group()
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.3, metalness: 0.85, emissive: new THREE.Color(0x0d0d0d), emissiveIntensity: 0.4 })
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.5, metalness: 0.7,  emissive: new THREE.Color(0x080808), emissiveIntensity: 0.3 })
    const redMat   = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.4, emissive: new THREE.Color(0x440000), emissiveIntensity: 0.5 })
    const eyeMat   = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: new THREE.Color(0xff3300), emissiveIntensity: 3.0 })
    const ventMat  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: new THREE.Color(0xff4400), emissiveIntensity: 2.5 })

    // Core torso — massive armoured box (scaled up for a juggernaut)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.3), steelMat)
    torso.castShadow = true; g.add(torso)

    // Torso side reinforcement ribs
    for (const sx of [-0.9, 0.9]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.18), darkMat)
      rib.position.set(sx, 0, 0.6); g.add(rib)
    }

    // Legs — thick hydraulic pistons
    for (const sx of [-0.62, 0.62]) {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.9, 0.58), steelMat)
      thigh.position.set(sx, -1.45, 0); thigh.castShadow = true; g.add(thigh)
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.85, 0.50), darkMat)
      shin.position.set(sx, -2.25, 0); shin.castShadow = true; g.add(shin)
      // Piston rod
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 6), steelMat)
      rod.position.set(sx, -1.85, 0.22); g.add(rod)
    }

    // Shoulder cannon pods (dual-barrel)
    for (const sx of [-1.2, 1.2]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 1.0, 8), steelMat)
      pod.rotation.z = Math.PI / 2; pod.position.set(sx, 0.75, 0.2)
      pod.castShadow = true; g.add(pod)
      // Twin barrels
      for (const bz of [-0.10, 0.10]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), darkMat)
        barrel.rotation.x = Math.PI / 2; barrel.position.set(sx, 0.75 + bz, 0.9); g.add(barrel)
      }
      // Muzzle glow
      const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), ventMat)
      muzzle.position.set(sx, 0.75, 1.52); g.add(muzzle)
    }

    // Arms connecting shoulder pods to body
    for (const sx of [-0.9, 0.9]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.36, 0.36), steelMat)
      arm.position.set(sx, 0.3, 0.1); g.add(arm)
    }

    // Head sensor block — wider, more menacing
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.70, 0.75), darkMat)
    head.position.set(0, 1.65, 0); head.castShadow = true; g.add(head)

    // Red glowing eyes — larger
    for (const ex of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat)
      eye.position.set(ex, 1.65, 0.40); g.add(eye)
    }

    // Glowing vent strips on torso
    for (const vy of [0.6, 0.0, -0.6]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), ventMat)
      vent.position.set(0, vy, 0.68); g.add(vent)
    }

    // Front armour plates (phase 1 only — removed in phase 2)
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.5, 0.24), redMat)
    frontPlate.position.set(0, 0, 0.79); frontPlate.castShadow = true
    g.add(frontPlate)
    this.armourMeshes.push(frontPlate)

    // Strong red point light at eye level
    const eyeLight = new THREE.PointLight(0xff2200, 3.5, 14)
    eyeLight.position.set(0, 1.65, 0.5); g.add(eyeLight)

    // Orange under-glow from vents
    const ventLight = new THREE.PointLight(0xff6600, 1.5, 8)
    ventLight.position.set(0, 0.2, 0.8); g.add(ventLight)

    g.scale.setScalar(1.1)   // 10% bigger — it's a juggernaut
    return g
  }

  protected tick(dt: number, playerPos: THREE.Vector3): void {
    this.checkAggro(playerPos, 100)
    const dist  = this.getPosition().distanceTo(playerPos)
    const phase = this.currentPhase()

    // ── Charge (phase 2) ─────────────────────────────────────────────────────
    if (this.isCharging) {
      this.body.velocity.x = this.chargeDir.x * CHARGE_SPD
      this.body.velocity.z = this.chargeDir.z * CHARGE_SPD
      this.chargeEnd -= dt
      if (this.chargeEnd <= 0 || dist < 2) {
        this.isCharging = false
        if (dist < 5) {
          bus.emit('aiWeaponFired', {
            agentId:   this.id,
            origin:    this.getPosition(),
            direction: playerPos.clone().sub(this.getPosition()).normalize(),
            damage:    110,
          })
        }
      }
      return   // skip normal movement during charge
    }

    // Normal movement
    if (dist > 12) this.moveToward(playerPos, 3 * phase.speedMult)

    // ── Minigun sweep ────────────────────────────────────────────────────────
    if (this.fireTimer <= 0 && dist < 55) {
      const shots    = this.phase === 1 ? 6 : 3
      const interval = this.phase === 1 ? 90 : 130
      for (let i = 0; i < shots; i++) {
        setTimeout(() => {
          if (!this.isDead()) this.shoot(playerPos, 18, 0.09)
        }, i * interval)
      }
      this.fireTimer = this.phase === 1 ? 0.55 : 1.1
    }

    // ── Ground stomp shockwave ────────────────────────────────────────────────
    this.stompTimer -= dt
    if (this.stompTimer <= 0) {
      bus.emit('blastDamage', { position: this.getPosition().clone(), radius: STOMP_R, damage: STOMP_DMG })
      bus.emit('bossEvent', { id: this.id, event: 'stomp', msg: 'IRON-7: *STOMP*' })
      this.stompTimer = this.phase === 1 ? 4 : 7
    }

    // ── Rocket salvo (phase 2) ────────────────────────────────────────────────
    if (this.phase === 1) {
      this.rocketTimer -= dt
      if (this.rocketTimer <= 0 && dist < 60) {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            if (!this.isDead()) {
              const splash = playerPos.clone().add(
                new THREE.Vector3((Math.random()-0.5)*8, 0, (Math.random()-0.5)*8))
              bus.emit('blastDamage', { position: splash, radius: 8, damage: 80 })
              bus.emit('explosion',   { position: splash })
            }
          }, i * 600)
        }
        this.rocketTimer = 6
      }

      // Charge toward player
      this.chargeTimer -= dt
      if (this.chargeTimer <= 0 && dist < 35 && dist > 8) {
        this.isCharging  = true
        this.chargeEnd   = CHARGE_DUR
        this.chargeDir   = playerPos.clone().sub(this.getPosition()).normalize()
        this.chargeDir.y = 0
        this.chargeTimer = 10
        bus.emit('bossEvent', { id: this.id, event: 'charge', msg: '⚠  IRON-7 IS CHARGING!' })
      }
    }
  }

  protected onPhaseChange(newPhase: number): void {
    if (newPhase === 1) {
      // Armour explodes off
      ;(this.body as unknown as Record<string, unknown>)['armour'] = 0
      bus.emit('explosion', { position: this.getPosition().clone() })
      bus.emit('blastDamage', { position: this.getPosition().clone(), radius: 6, damage: 40 })
      bus.emit('bossEvent', { id: this.id, event: 'armour_breach',
        msg: '⚠  IRON-7 ARMOUR BREACH — BERSERK MODE' })
      bus.emit('bossMusic', { intensity: 'phase2' })

      // Remove armour mesh from group
      if (this.mesh) {
        for (const am of this.armourMeshes) {
          (this.mesh as unknown as THREE.Group).remove(am)
        }
      }
    }
  }
}
