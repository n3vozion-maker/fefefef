import { bus } from './EventBus'

const FIXED_DT = 1 / 60

export class GameLoop {
  private running = false
  private lastTime = 0
  private accumulator = 0
  private rafId = 0

  start(): void {
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private tick = (now: number): void => {
    if (!this.running) return

    const elapsed = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now
    this.accumulator += elapsed

    while (this.accumulator >= FIXED_DT) {
      bus.emit('fixedUpdate', FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    const alpha = this.accumulator / FIXED_DT
    bus.emit('render', alpha)

    this.rafId = requestAnimationFrame(this.tick)
  }
}
