import { bus } from '../core/EventBus'

export class CombatSystem {
  init(): void {
    bus.on('weaponFired', (_payload) => {
      // Hit detection — implemented in Step 4
    })
  }
}
