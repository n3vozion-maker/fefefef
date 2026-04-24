import type { WeaponDefinition } from './WeaponRegistry'

export abstract class WeaponBase {
  protected stats: WeaponDefinition
  protected ammoInMag: number
  protected isReloading = false

  constructor(definition: WeaponDefinition) {
    this.stats = { ...definition }
    this.ammoInMag = definition.magazineSize
  }

  abstract fire(): void
  abstract reload(): void
  abstract aim(active: boolean): void

  getAmmo(): number { return this.ammoInMag }
  getMagSize(): number { return this.stats.magazineSize }
}
