import * as THREE from 'three'

import { GameLoop }          from './core/GameLoop'
import { ServiceLocator }    from './core/ServiceLocator'
import { bus }               from './core/EventBus'
import { Renderer }          from './renderer/Renderer'
import { InputManager }      from './input/InputManager'
import { PhysicsWorld }      from './physics/PhysicsWorld'
import { Raycast }           from './physics/Raycast'
import { PlayerCamera }      from './player/PlayerCamera'
import { PlayerController }  from './player/PlayerController'
import { InteractionSystem } from './player/InteractionSystem'
import { WorldManager }      from './world/WorldManager'
import { SaveSystem }        from './persistence/SaveSystem'
import { CheckpointManager } from './persistence/CheckpointManager'
import { getTerrainHeight }  from './world/TerrainNoise'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const renderer  = new Renderer()
const input     = new InputManager()
const physics   = new PhysicsWorld()
const playerCam = new PlayerCamera(renderer.camera)
const player    = new PlayerController(physics, input, playerCam)
const raycast   = new Raycast(physics)
const interact  = new InteractionSystem(player, raycast)
const world     = new WorldManager(renderer.scene, physics)
const loop      = new GameLoop()

ServiceLocator.register('renderer', renderer)
ServiceLocator.register('input',    input)
ServiceLocator.register('physics',  physics)
ServiceLocator.register('player',   player)
ServiceLocator.register('world',    world)

// Spawn player above terrain at origin
const spawnH = getTerrainHeight(0, 0)
player.body.position.set(0, spawnH + 2.5, 0)

// Persistence
const checkpoint = new CheckpointManager(() => ({
  playerPos: { x: player.body.position.x, y: player.body.position.y, z: player.body.position.z },
  health: 100,
  ammo: {},
  missionId: null,
  completedObjectives: [],
  playtime: 0,
}))
checkpoint.init()

input.init()
renderer.getCanvas().addEventListener('click', () =>
  input.requestPointerLock(renderer.getCanvas())
)

// ── Scene lighting ────────────────────────────────────────────────────────────

const { scene } = renderer
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.FogExp2(0xb0cfe0, 0.00045)

const sun = new THREE.DirectionalLight(0xfff5e0, 2.2)
sun.position.set(600, 400, 300)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far  = 1_200
sun.shadow.camera.left = sun.shadow.camera.bottom = -300
sun.shadow.camera.right = sun.shadow.camera.top   =  300
scene.add(sun)
scene.add(new THREE.AmbientLight(0x4060a0, 0.55))

const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.4)
scene.add(hemi)

// ── Minimal HUD ───────────────────────────────────────────────────────────────

// Crosshair
const crosshair = document.createElement('div')
Object.assign(crosshair.style, {
  position: 'fixed', top: '50%', left: '50%',
  transform: 'translate(-50%,-50%)',
  width: '4px', height: '4px', background: 'rgba(255,255,255,0.85)',
  borderRadius: '50%', pointerEvents: 'none',
})
document.body.appendChild(crosshair)

// Stamina bar
const staminaBar = document.createElement('div')
Object.assign(staminaBar.style, {
  position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
  width: '180px', height: '5px', background: '#1a1a1a', borderRadius: '3px', pointerEvents: 'none',
})
const staminaFill = document.createElement('div')
Object.assign(staminaFill.style, {
  height: '100%', width: '100%', background: '#4caf50', borderRadius: '3px',
})
staminaBar.appendChild(staminaFill)
document.body.appendChild(staminaBar)

// State label (dev aid)
const stateLabel = document.createElement('div')
Object.assign(stateLabel.style, {
  position: 'fixed', top: '12px', left: '12px', color: 'rgba(255,255,255,0.55)',
  fontFamily: 'monospace', fontSize: '12px', pointerEvents: 'none',
})
document.body.appendChild(stateLabel)

// Click-to-lock prompt
const lockPrompt = document.createElement('div')
Object.assign(lockPrompt.style, {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  color: '#fff', fontFamily: 'monospace', fontSize: '16px',
  background: 'rgba(0,0,0,0.55)', padding: '12px 24px', borderRadius: '4px',
  pointerEvents: 'none',
})
lockPrompt.textContent = 'Click to play'
document.body.appendChild(lockPrompt)

// ── Game loop ─────────────────────────────────────────────────────────────────

bus.on<number>('fixedUpdate', (dt) => {
  if (input.isPointerLocked()) {
    lockPrompt.style.display = 'none'
    const { x, y } = input.flushMouseDelta()
    playerCam.applyMouseDelta(x, y)
  } else {
    lockPrompt.style.display = ''
  }

  physics.step(dt)
  player.update(dt)

  const playerPos = new THREE.Vector3(
    player.body.position.x,
    player.body.position.y,
    player.body.position.z,
  )

  world.update(playerPos, dt)

  const basePos = player.getCameraBase()
  playerCam.update(dt, basePos, player.isMoving(), player.isSprinting(), player.getState())

  // HUD
  staminaFill.style.width      = `${player.stamina}%`
  staminaFill.style.background = player.stamina < 25 ? '#e53935' : '#4caf50'

  const p = player.body.position
  stateLabel.textContent =
    `state: ${player.getState()}  |  ` +
    `pos: ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  |  ` +
    `stamina: ${player.stamina.toFixed(0)}`
})

loop.start()
