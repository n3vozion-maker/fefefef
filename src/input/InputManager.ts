import { bus } from '../core/EventBus'
import { Action, defaultKeyMap } from './InputMap'

export interface MouseDelta { x: number; y: number }

export class InputManager {
  private held = new Set<Action>()
  private keyMap: Record<string, Action>
  mouseDelta: MouseDelta = { x: 0, y: 0 }
  mouseButtons = { left: false, right: false }
  private locked = false

  constructor(keyMap = defaultKeyMap) {
    this.keyMap = { ...keyMap }
  }

  init(): void {
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
  }

  requestPointerLock(canvas: HTMLCanvasElement): void {
    canvas.requestPointerLock()
  }

  isHeld(action: Action): boolean {
    return this.held.has(action)
  }

  isPointerLocked(): boolean {
    return this.locked
  }

  flushMouseDelta(): MouseDelta {
    const d = { ...this.mouseDelta }
    this.mouseDelta.x = 0
    this.mouseDelta.y = 0
    return d
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const action = this.keyMap[e.code]
    if (!action) return
    this.held.add(action)
    bus.emit('actionDown', action)
    if (action === 'quicksave') e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = this.keyMap[e.code]
    if (!action) return
    this.held.delete(action)
    bus.emit('actionUp', action)
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return
    this.mouseDelta.x += e.movementX
    this.mouseDelta.y += e.movementY
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) { this.mouseButtons.left = true; bus.emit('actionDown', 'fire' as Action) }
    if (e.button === 2) { this.mouseButtons.right = true; bus.emit('actionDown', 'aim' as Action) }
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) { this.mouseButtons.left = false; bus.emit('actionUp', 'fire' as Action) }
    if (e.button === 2) { this.mouseButtons.right = false; bus.emit('actionUp', 'aim' as Action) }
  }

  private onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement !== null
  }
}
