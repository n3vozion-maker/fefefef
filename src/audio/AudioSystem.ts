import { SoundManager } from './SoundManager'
import { MusicManager } from './MusicManager'

export class AudioSystem {
  readonly sounds = new SoundManager()
  readonly music = new MusicManager()

  init(): void {}
  update(): void { this.music.update() }
}
