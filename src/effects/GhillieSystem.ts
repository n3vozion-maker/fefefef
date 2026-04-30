import { bus } from '../core/EventBus'

// Singleton — imported by AIAgent.ts to reduce detection range when active.
// Active only when ghillie suit is equipped AND player is prone.

class GhillieSystem {
  private _equipped = false
  private _prone    = false

  constructor() {
    bus.on<boolean>('proneChanged', (v) => { this._prone = v })
    bus.on<boolean>('ghillieEquipped', (v) => { this._equipped = v })
  }

  get active(): boolean { return this._equipped && this._prone }
  get equipped(): boolean { return this._equipped }

  equip(): void   { this._equipped = true;  bus.emit('ghillieEquipped', true)  }
  unequip(): void { this._equipped = false; bus.emit('ghillieEquipped', false) }
}

export const ghillie = new GhillieSystem()
