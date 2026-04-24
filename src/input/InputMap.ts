export type Action =
  | 'moveForward'
  | 'moveBack'
  | 'moveLeft'
  | 'moveRight'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'prone'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'interact'
  | 'melee'
  | 'grenade'
  | 'weapon1'
  | 'weapon2'
  | 'sidearm'
  | 'quicksave'

export const defaultKeyMap: Record<string, Action> = {
  KeyW: 'moveForward',
  KeyS: 'moveBack',
  KeyA: 'moveLeft',
  KeyD: 'moveRight',
  Space: 'jump',
  ShiftLeft: 'sprint',
  KeyC: 'crouch',
  KeyZ: 'prone',
  KeyR: 'reload',
  KeyF: 'interact',
  KeyV: 'melee',
  KeyG: 'grenade',
  Digit1: 'weapon1',
  Digit2: 'weapon2',
  Digit3: 'sidearm',
  F5: 'quicksave',
}
