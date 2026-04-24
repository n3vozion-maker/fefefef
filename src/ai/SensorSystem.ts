export type AlertState = 'unaware' | 'suspicious' | 'combat'

export class SensorSystem {
  sightRange = 40
  sightAngle = 90
  hearingRadius = 20

  check(_agentPos: { x: number; z: number }, _playerPos: { x: number; z: number }): AlertState {
    return 'unaware'
  }
}
