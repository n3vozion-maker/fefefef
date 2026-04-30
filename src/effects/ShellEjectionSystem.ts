import * as THREE from 'three'
import { bus }    from '../core/EventBus'
import type { WeaponFiredPayload } from '../weapons/WeaponBase'

// Small brass cylinders ejected on every shot.
// They arc outward, bounce once, then fade over ~1.8 s.

const GRAVITY     = -18
const LIFETIME    = 1.8
const BOUNCE_Y    = 0.12   // m height above spawn to bounce back up
const MAX_SHELLS  = 120

const shellGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.055, 6)
const shellMat = new THREE.MeshStandardMaterial({ color: 0xc8960a, metalness: 0.85, roughness: 0.25 })

interface Shell {
  mesh:    THREE.Mesh
  vel:     THREE.Vector3
  life:    number
  bounced: boolean
}

export class ShellEjectionSystem {
  private shells: Shell[] = []

  constructor(private scene: THREE.Scene) {
    bus.on<WeaponFiredPayload>('weaponFired', (p) => this.eject(p))
  }

  update(dt: number): void {
    for (const s of this.shells) {
      s.life -= dt
      s.vel.y += GRAVITY * dt
      s.mesh.position.addScaledVector(s.vel, dt)
      s.mesh.rotation.x += s.vel.length() * dt * 8

      // Simple ground bounce
      if (!s.bounced && s.mesh.position.y <= (s.mesh.userData['groundY'] as number)) {
        s.mesh.position.y = (s.mesh.userData['groundY'] as number)
        s.vel.y  = Math.abs(s.vel.y) * 0.28
        s.vel.x *= 0.45
        s.vel.z *= 0.45
        s.bounced = true
      }

      // Fade out last 0.4 s
      if (s.life < 0.4) {
        (s.mesh.material as THREE.MeshStandardMaterial).opacity = s.life / 0.4
      }
    }

    const dead = this.shells.filter(s => s.life <= 0)
    for (const s of dead) this.scene.remove(s.mesh)
    this.shells = this.shells.filter(s => s.life > 0)
  }

  private eject(p: WeaponFiredPayload): void {
    if (this.shells.length >= MAX_SHELLS) {
      const old = this.shells.shift()!
      this.scene.remove(old.mesh)
    }

    const cat = p.weapon.getCategory()
    // No shell for explosives or flags
    if (cat === 'explosive' || cat === 'flag') return

    // Eject sideways-right from the muzzle origin with random arc
    const right = new THREE.Vector3()
      .crossVectors(p.direction, new THREE.Vector3(0, 1, 0))
      .normalize()

    const vel = new THREE.Vector3(
      right.x * (2.5 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.8,
      2.2 + Math.random() * 1.4,
      right.z * (2.5 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.8,
    )

    const mat  = shellMat.clone()
    mat.transparent = true
    const mesh = new THREE.Mesh(shellGeo, mat)
    mesh.position.copy(p.origin).addScaledVector(right, 0.18)
    mesh.position.y -= 0.08  // at ejection port level
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)

    // Ground reference ~2 m below origin
    mesh.userData['groundY'] = p.origin.y - 1.85

    this.scene.add(mesh)
    this.shells.push({ mesh, vel, life: LIFETIME, bounced: false })
  }
}
