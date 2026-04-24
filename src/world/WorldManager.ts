import type { PointOfInterest } from './PointOfInterest'

export class WorldManager {
  private pois: PointOfInterest[] = []

  update(_playerX: number, _playerZ: number): void {}

  registerPOI(poi: PointOfInterest): void {
    this.pois.push(poi)
  }
}
