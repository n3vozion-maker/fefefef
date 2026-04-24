import { bus } from '../core/EventBus'
import type { PlayerController } from './PlayerController'
import type { Raycast } from '../physics/Raycast'

const INTERACT_RANGE = 2.0  // m

export type InteractableType = 'door' | 'pickup'

export interface Interactable {
  type: InteractableType
  id: string
  onInteract(): void
}

export class InteractionSystem {
  private interactables = new Map<string, Interactable>()

  constructor(
    private player: PlayerController,
    private raycast: Raycast,
  ) {
    bus.on<string>('actionDown', (action) => {
      if (action === 'interact') this.tryInteract()
    })
  }

  register(interactable: Interactable): void {
    this.interactables.set(interactable.id, interactable)
  }

  unregister(id: string): void {
    this.interactables.delete(id)
  }

  update(): void {}

  private tryInteract(): void {
    const { x, y, z } = this.player.body.position
    const camBase = this.player.getCameraBase()
    const hit = this.raycast.cast(
      { x: camBase.x, y: camBase.y, z: camBase.z },
      { x: camBase.x, y: camBase.y, z: camBase.z - INTERACT_RANGE },
    )
    if (!hit || !hit.body) return

    const bodyId = (hit.body as unknown as { interactId?: string }).interactId
    if (!bodyId) return

    const target = this.interactables.get(bodyId)
    if (!target) return

    target.onInteract()
    bus.emit('interacted', { type: target.type, id: bodyId })
    void x; void y; void z
  }
}
