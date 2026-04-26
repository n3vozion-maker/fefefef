import * as THREE from 'three'
import { WeaponBase } from './WeaponBase'
import { WeaponRegistry } from './WeaponRegistry'
import { bus } from '../core/EventBus'

type FirearmConfig = {
  automatic:   boolean
  recoilP:     number   // pitch per shot (radians)
  recoilY:     number   // yaw spread per shot (radians)
  reserveAmmo?: number
  spread?:      number  // bullet spread cone half-angle (radians)
  pellets?:     number  // shotgun pellets
}

const PRESETS: Record<string, FirearmConfig> = {
  rifle_m4a1:         { automatic: true,  recoilP: 0.022, recoilY: 0.006, spread: 0.008 },
  rifle_ak47:         { automatic: true,  recoilP: 0.030, recoilY: 0.010, spread: 0.012 },
  smg_mp5:            { automatic: true,  recoilP: 0.015, recoilY: 0.008, spread: 0.014 },
  pistol_m9:          { automatic: false, recoilP: 0.025, recoilY: 0.008 },
  pistol_desert_eagle:{ automatic: false, recoilP: 0.055, recoilY: 0.012 },
  sniper_awp:         { automatic: false, recoilP: 0.080, recoilY: 0.004, spread: 0.001 },
  sniper_barrett:     { automatic: false, recoilP: 0.110, recoilY: 0.003, spread: 0.0005 },
  shotgun_870:        { automatic: false, recoilP: 0.060, recoilY: 0.020, pellets: 8,  spread: 0.06 },
  shotgun_spas:       { automatic: false, recoilP: 0.055, recoilY: 0.018, pellets: 10, spread: 0.07 },
  explosive_rpg7:     { automatic: false, recoilP: 0.100, recoilY: 0.005 },
  explosive_grenade:  { automatic: false, recoilP: 0.040, recoilY: 0.010 },
}

export class FirearmWeapon extends WeaponBase {
  private cfg: FirearmConfig

  constructor(id: string) {
    const def = WeaponRegistry.get(id)
    const cfg = PRESETS[id] ?? { automatic: false, recoilP: 0.03, recoilY: 0.008 }
    super(def, cfg.reserveAmmo)
    this.cfg = cfg
  }

  get isAutomatic(): boolean { return this.cfg.automatic }
  get recoilPitch():  number { return this.cfg.recoilP }
  get recoilYaw():    number { return this.cfg.recoilY }

  protected override onFire(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const pellets = this.cfg.pellets ?? 1

    for (let i = 0; i < pellets; i++) {
      const spread = this.cfg.spread ?? 0
      const dir = direction.clone()
      if (spread > 0) {
        dir.x += (Math.random() - 0.5) * spread * 2
        dir.y += (Math.random() - 0.5) * spread * 2
        dir.z += (Math.random() - 0.5) * spread * 2
        dir.normalize()
      }
      bus.emit('weaponFired', {
        origin,
        direction: dir,
        weapon: this,
        damage: pellets > 1 ? this.stats.damage / pellets : undefined,
      })
    }
  }
}
