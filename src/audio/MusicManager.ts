export type MusicState = 'explore' | 'stealth' | 'combat'

export class MusicManager {
  private state: MusicState = 'explore'

  setState(state: MusicState): void {
    if (this.state === state) return
    this.state = state
  }

  update(): void {}
}
