import { bus } from '../core/EventBus'

// ── ConsumableInventory ───────────────────────────────────────────────────────
// Tracks repair kits and fuel canisters the player is carrying.
// Notifies bus on every change so HUD can react.

export class ConsumableInventory {
  private _repairKits    = 0
  private _fuelCanisters = 0

  get repairKits():    number { return this._repairKits }
  get fuelCanisters(): number { return this._fuelCanisters }

  addRepairKit(n = 1): void {
    this._repairKits += n
    this.emit()
  }

  addFuelCanister(n = 1): void {
    this._fuelCanisters += n
    this.emit()
  }

  useRepairKit(): boolean {
    if (this._repairKits <= 0) return false
    this._repairKits--
    this.emit()
    return true
  }

  useFuelCanister(): boolean {
    if (this._fuelCanisters <= 0) return false
    this._fuelCanisters--
    this.emit()
    return true
  }

  private emit(): void {
    bus.emit('consumablesChanged', {
      repairKits:    this._repairKits,
      fuelCanisters: this._fuelCanisters,
    })
  }
}
