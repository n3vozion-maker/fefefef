import * as THREE from 'three'
import type { WeaponBase } from './WeaponBase'

const STAND_POS  = new THREE.Vector3( 0.28, -0.22, -0.42)
const ADS_POS    = new THREE.Vector3( 0.00, -0.13, -0.30)
const LERP_SPEED = 14

// Material palette
const matBody   = new THREE.MeshStandardMaterial({ color: 0x2d3a1e, roughness: 0.85, metalness: 0.15, depthTest: false })
const matMetal  = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.45, metalness: 0.85, depthTest: false })
const matGrip   = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.95, metalness: 0.05, depthTest: false })

export class Viewmodel {
  private group:    THREE.Group
  private body:     THREE.Mesh
  private barrel:   THREE.Mesh
  private muzzleFlash: THREE.PointLight
  private flashTimer = 0
  private adsT       = 0
  private swayT      = 0
  private swayX      = 0
  private swayY      = 0

  constructor(private camera: THREE.PerspectiveCamera) {
    this.group = new THREE.Group()
    this.group.renderOrder = 999

    // Receiver / upper body — wide and clearly visible
    const bodyGeo = new THREE.BoxGeometry(0.075, 0.095, 0.38)
    this.body = new THREE.Mesh(bodyGeo, matBody)
    this.body.position.set(0, 0, 0)

    // Handguard — slightly wider, sits in front
    const hgGeo = new THREE.BoxGeometry(0.068, 0.068, 0.18)
    const hg    = new THREE.Mesh(hgGeo, matMetal)
    hg.position.set(0, 0, -0.22)

    // Pistol grip — angled block below receiver
    const gripGeo = new THREE.BoxGeometry(0.055, 0.12, 0.06)
    const grip    = new THREE.Mesh(gripGeo, matGrip)
    grip.position.set(0, -0.10, 0.10)
    grip.rotation.x = 0.22

    // Stock — box behind receiver
    const stockGeo = new THREE.BoxGeometry(0.055, 0.07, 0.14)
    const stock     = new THREE.Mesh(stockGeo, matBody)
    stock.position.set(0, 0.005, 0.24)

    // Barrel — long, metal, extends forward
    const barGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8)
    this.barrel  = new THREE.Mesh(barGeo, matMetal)
    this.barrel.rotation.x = Math.PI / 2
    this.barrel.position.set(0, 0.01, -0.30)

    // Suppressor hint / muzzle block
    const muzzleGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.07, 8)
    const muzzle    = new THREE.Mesh(muzzleGeo, matMetal)
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.set(0, 0.01, -0.47)

    this.muzzleFlash = new THREE.PointLight(0xff8800, 0, 8)
    this.muzzleFlash.position.set(0, 0.01, -0.54)

    this.group.add(this.body, hg, grip, stock, this.barrel, muzzle, this.muzzleFlash)
    this.group.position.copy(STAND_POS)

    camera.add(this.group)
  }

  setWeapon(weapon: WeaponBase | null): void {
    this.group.visible = weapon !== null
    if (!weapon) return
    const s = weapon.getStats()
    const scale = s.category === 'sniper'  ? 1.25
                : s.category === 'shotgun' ? 1.08
                : s.category === 'smg'     ? 0.88
                : s.category === 'pistol'  ? 0.72
                : 1.0
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

    // Idle breathing sway — figure-8 drift, nearly zero in ADS
    const swayAmp = (1 - t) * 0.0038
    this.swayT   += dt * 0.85
    this.swayX    = Math.cos(this.swayT * 0.65) * swayAmp
    this.swayY    = Math.sin(this.swayT * 1.10) * swayAmp * 0.7
    this.group.position.x += this.swayX
    this.group.position.y += this.swayY

    // Reload bob
    if (reloading) {
      this.group.rotation.x = Math.sin(Date.now() * 0.006) * 0.04
    } else {
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, dt * 10)
    }
    // Always recover yaw kick (was never reset — caused permanent sideways tilt)
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, 0, dt * 10)

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
