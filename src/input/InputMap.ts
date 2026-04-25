export type Action =
  | 'moveForward' | 'moveBack' | 'moveLeft' | 'moveRight'
  | 'jump' | 'sprint' | 'crouch' | 'fire' | 'aim'
  | 'reload' | 'interact' | 'melee' | 'grenade'
  | 'weapon1' | 'weapon2' | 'sidearm'
  | 'dash' | 'parry'
  | 'quicksave' | 'vehicleExit'

export const defaultKeyMap: Record<string, Action> = {
  KeyW: 'moveForward',
  KeyS: 'moveBack',
  KeyA: 'moveLeft',
  KeyD: 'moveRight',
  Space:      'jump',
  ShiftLeft:  'sprint',
  KeyC:       'crouch',
  KeyR:       'reload',
  KeyE:       'interact',
  KeyV:       'melee',
  KeyG:       'grenade',
  KeyQ:       'parry',
  ControlLeft:'dash',
  Digit1: 'weapon1',
  Digit2: 'weapon2',
  Digit3: 'sidearm',
  F5:     'quicksave',
  KeyF:   'vehicleExit',
}
