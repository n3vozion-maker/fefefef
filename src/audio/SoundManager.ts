export class SoundManager {
  play(_id: string, _position?: { x: number; y: number; z: number }): void {}
  stop(_id: string): void {}
  fade(_id: string, _toVolume: number, _duration: number): void {}
}
