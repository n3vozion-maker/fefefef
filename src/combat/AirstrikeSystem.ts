import * as THREE from 'three'
import { bus }    from '../core/EventBus'

// ── AirstrikeSystem ──────────────────────────────────────────────────────────
// Unlocked after mission 3.
// Usage: throw smoke flare (G while crouching) → 4 s later strafing run.
// Single charge; refills at checkpoints.

const STRAFE_PASSES    = 6        // number of bomb impacts
const STRAFE_INTERVAL  = 0.45     // s between impacts
const STRAFE_SPREAD    = 14       // m spacing along attack axis
const CALL_DELAY       = 4.0      // s between smoke throw and first impact
const CHARGE_RADIUS    = 15       // blast radius per impact
const CHARGE_DAMAGE    = 120      // damage per impact
const SMOKE_LIFETIME   = 8.0      // s smoke visible

interface SmokePuff {
  mesh:  THREE.Mesh
  life:  number
  vel:   THREE.Vector3
}

const puffGeo = new THREE.SphereGeometry(0.6, 6, 4)
const smokeMats = [
  new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.55, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xdd3311, transparent: true, opacity: 0.45, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.35, depthWrite: false }),
]

export class AirstrikeSystem {
  private charges    = 1         // starts with 1 charge
  private onCooldown = false
  private locked     = true      // locked until mission 3 complete
  private puffs:     SmokePuff[] = []
  private hudEl:     HTMLElement

  constructor(private scene: THREE.Scene) {
    this.hudEl = this.buildHUD()

    bus.on<string>('missionCompleted', (id) => {
      if (id === 'mission_3') {
        this.locked = false
        this.hudEl.style.display = 'block'
        bus.emit('hudNotify', 'AIRSTRIKE UNLOCKED — G while crouching')
      }
    })

    // Refill after completing each objective (represents checkpoint resupply)
    bus.on('objectiveCompleted', () => { this.charges = 1; this.renderHUD() })
    bus.on('gameStarted',        () => { this.charges = 1; this.renderHUD() })

    this.render()
  }

  get available(): boolean { return !this.locked && this.charges > 0 && !this.onCooldown }

  call(targetPos: THREE.Vector3): void {
    if (!this.available) return
    this.charges--
    this.onCooldown = true
    this.renderHUD()

    // Smoke flare at target
    this.spawnSmoke(targetPos)
    bus.emit('hudNotify', '◈ AIRSTRIKE INBOUND')

    // Schedule strafing run
    const attackAxis = new THREE.Vector3(
      Math.cos(Math.random() * Math.PI * 2),
      0,
      Math.sin(Math.random() * Math.PI * 2),
    )

    const start = targetPos.clone().addScaledVector(attackAxis, -(STRAFE_PASSES / 2) * STRAFE_SPREAD)

    for (let i = 0; i < STRAFE_PASSES; i++) {
      const delay = CALL_DELAY + i * STRAFE_INTERVAL
      const impactPos = start.clone().addScaledVector(attackAxis, i * STRAFE_SPREAD)
      setTimeout(() => {
        bus.emit('explosion',   { position: impactPos })
        bus.emit('blastDamage', { position: impactPos, radius: CHARGE_RADIUS, damage: CHARGE_DAMAGE })
        this.spawnImpactSmoke(impactPos)
      }, delay * 1000)
    }

    // Re-enable after run completes
    setTimeout(() => { this.onCooldown = false; this.renderHUD() },
      (CALL_DELAY + STRAFE_PASSES * STRAFE_INTERVAL + 1.5) * 1000)
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      p.life -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.scale.addScalar(dt * 0.8)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity =
        Math.min(0.55, p.life / SMOKE_LIFETIME) * 0.7
    }
    const dead = this.puffs.filter(p => p.life <= 0)
    for (const p of dead) this.scene.remove(p.mesh)
    this.puffs = this.puffs.filter(p => p.life > 0)
  }

  private spawnSmoke(pos: THREE.Vector3): void {
    for (let i = 0; i < 18; i++) {
      const mat  = (smokeMats[i % smokeMats.length]!).clone()
      const mesh = new THREE.Mesh(puffGeo, mat)
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 0.5,
        (Math.random() - 0.5) * 2,
      ))
      mesh.scale.setScalar(0.4 + Math.random() * 0.8)
      this.scene.add(mesh)
      this.puffs.push({
        mesh, life: SMOKE_LIFETIME * (0.7 + Math.random() * 0.3),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          0.3 + Math.random() * 0.8,
          (Math.random() - 0.5) * 0.6,
        ),
      })
    }
  }

  private spawnImpactSmoke(pos: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      const mat  = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5, depthWrite: false })
      const mesh = new THREE.Mesh(puffGeo, mat)
      mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4,
      ))
      mesh.scale.setScalar(0.5 + Math.random())
      this.scene.add(mesh)
      this.puffs.push({
        mesh, life: 3.5,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 1.5),
      })
    }
  }

  private render(): void { this.renderHUD() }

  private renderHUD(): void {
    if (this.locked) return
    this.hudEl.textContent = this.onCooldown
      ? '◈ AIRSTRIKE …'
      : this.charges > 0 ? `◈ AIRSTRIKE  [${this.charges}]` : '◈ AIRSTRIKE  —'
    this.hudEl.style.color = this.charges > 0 && !this.onCooldown
      ? 'rgba(255,180,40,0.80)' : 'rgba(255,255,255,0.28)'
  }

  private buildHUD(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:      'fixed',
      bottom:        '80px',
      right:         '18px',
      display:       'none',
      pointerEvents: 'none',
      zIndex:        '20',
      fontFamily:    'monospace',
      fontSize:      '9px',
      letterSpacing: '.16em',
    })
    document.body.appendChild(el)
    return el
  }
}
