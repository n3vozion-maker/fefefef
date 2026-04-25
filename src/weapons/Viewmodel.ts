import * as THREE from 'three'
import type { WeaponBase } from './WeaponBase'

const STAND_POS  = new THREE.Vector3( 0.22, -0.18, -0.35)
const ADS_POS    = new THREE.Vector3( 0.00, -0.12, -0.28)
const LERP_SPEED = 14

export class Viewmodel {
  private group:    THREE.Group
  private body:     THREE.Mesh
  private barrel:   THREE.Mesh
  private muzzleFlash: THREE.PointLight
  private flashTimer = 0
  private adsT       = 0

  constructor(private camera: THREE.PerspectiveCamera) {
    this.group = new THREE.Group()
    this.group.renderOrder = 999

    const bodyGeo  = new THREE.BoxGeometry(0.06, 0.06, 0.22)
    const barGeo   = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6)
    const mat      = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5, depthTest: false })

    this.body   = new THREE.Mesh(bodyGeo, mat)
    this.barrel = new THREE.Mesh(barGeo,  mat)
    this.barrel.rotation.x = Math.PI / 2
    this.barrel.position.set(0, 0, -0.2)

    this.muzzleFlash = new THREE.PointLight(0xff9900, 0, 6)
    this.muzzleFlash.position.set(0, 0, -0.38)

    this.group.add(this.body, this.barrel, this.muzzleFlash)
    this.group.position.copy(STAND_POS)

    camera.add(this.group)
  }

  setWeapon(weapon: WeaponBase | null): void {
    this.group.visible = weapon !== null
    if (!weapon) return
    const s = weapon.getStats()
    // Scale viewmodel by weapon category
    const scale = s.category === 'sniper' ? 1.3 : s.category === 'shotgun' ? 1.1 : 1.0
    this.group.scale.setScalar(scale)
  }

  flash(): void {
    this.muzzleFlash.intensity = 4
    this.flashTimer = 0.045
  }

  update(dt: number, ads: boolean, reloading: boolean): void {
    // ADS lerp
    this.adsT += (ads ? dt : -dt) * LERP_SPEED
    this.adsT  = Math.max(0, Math.min(1, this.adsT))
    const t    = easeInOut(this.adsT)
    this.group.position.lerpVectors(STAND_POS, ADS_POS, t)

    // Reload bob
    if (reloading) {
      this.group.rotation.x = Math.sin(Date.now() * 0.006) * 0.04
    } else {
      this.group.rotation.x *= 0.85
    }

    // Muzzle flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt
      if (this.flashTimer <= 0) this.muzzleFlash.intensity = 0
    }
  }

  kick(pitch: number, yaw: number): void {
    this.group.rotation.x -= pitch * 3
    this.group.rotation.y += yaw   * 2
  }
}

function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
