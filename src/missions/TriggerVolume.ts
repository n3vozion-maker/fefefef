import { bus } from '../core/EventBus'

export class TriggerVolume {
  private fired = false

  constructor(
    private min: { x: number; y: number; z: number },
    private max: { x: number; y: number; z: number },
    private eventName: string,
    private payload?: unknown,
  ) {}

  check(pos: { x: number; y: number; z: number }): void {
    if (this.fired) return
    if (
      pos.x >= this.min.x && pos.x <= this.max.x &&
      pos.y >= this.min.y && pos.y <= this.max.y &&
      pos.z >= this.min.z && pos.z <= this.max.z
    ) {
      this.fired = true
      bus.emit(this.eventName, this.payload)
    }
  }

  reset(): void { this.fired = false }
}
