import { SaveSystem, type SaveData } from './SaveSystem'
import { bus } from '../core/EventBus'

export class CheckpointManager {
  private getData: () => SaveData

  constructor(getData: () => SaveData) {
    this.getData = getData
  }

  init(): void {
    bus.on('enterCheckpoint', () => this.save())
    bus.on('actionDown', (action) => {
      if (action === 'quicksave') this.save()
    })
  }

  private save(): void {
    SaveSystem.save(this.getData())
  }
}
