import * as THREE from 'three'
import * as CANNON from 'cannon-es'

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

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const renderer  = new Renderer()
const input     = new InputManager()
const physics   = new PhysicsWorld()
const playerCam = new PlayerCamera(renderer.camera)
const player    = new PlayerController(physics, input, playerCam)
const raycast   = new Raycast(physics)
const interact  = new InteractionSystem(player, raycast)
const loop      = new GameLoop()

ServiceLocator.register('renderer',  renderer)
ServiceLocator.register('input',     input)
ServiceLocator.register('physics',   physics)
ServiceLocator.register('player',    player)
ServiceLocator.register('interact',  interact)

input.init()

renderer.getCanvas().addEventListener('click', () =>
  input.requestPointerLock(renderer.getCanvas())
)

// ── Test scene ────────────────────────────────────────────────────────────────

const { scene } = renderer

// Sky + fog
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.Fog(0x87ceeb, 120, 700)

// Ground mesh (physics ground is already added by PhysicsWorld constructor)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshStandardMaterial({ color: 0x3a5f3a, roughness: 0.9 }),
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)
scene.add(new THREE.GridHelper(600, 60, 0x3d6b3d, 0x3d6b3d))

// Lighting
const sun = new THREE.DirectionalLight(0xfff5e0, 2.2)
sun.position.set(60, 120, 40)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 0.5
sun.shadow.camera.far  = 600
sun.shadow.camera.left = sun.shadow.camera.bottom = -120
sun.shadow.camera.right = sun.shadow.camera.top   =  120
scene.add(sun)
scene.add(new THREE.AmbientLight(0x304060, 0.7))

// Wall-run corridors — tall flat walls for testing movement chaining
const wallRunConfigs = [
  { x:  0,  z: -15, w: 0.5, h: 6, d: 12 },   // left wall of corridor
  { x:  6,  z: -15, w: 0.5, h: 6, d: 12 },   // right wall of corridor
  { x: -10, z: -30, w: 14,  h: 6, d: 0.5 },  // crossway wall
  { x:  10, z: -30, w: 0.5, h: 6, d: 12 },   // side wall
]
for (const cfg of wallRunConfigs) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
    new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.7 }),
  )
  mesh.position.set(cfg.x, cfg.h / 2, cfg.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(new CANNON.Box(new CANNON.Vec3(cfg.w / 2, cfg.h / 2, cfg.d / 2)))
  body.position.set(cfg.x, cfg.h / 2, cfg.z)
  physics.addBody(body)
}

// Reference boxes — vaultable heights mixed in
const boxConfigs = [
  // low vaultable crates (0.6–1.2 m)
  { x:  5, z: -8,  w: 1.5, h: 0.7,  d: 1.5 },
  { x: -4, z: -6,  w: 2,   h: 1.0,  d: 2   },
  { x:  8, z: -5,  w: 1.5, h: 1.2,  d: 1.5 },
  // taller walls (not vaultable)
  { x: 15, z: -12, w: 3,   h: 3.5,  d: 1   },
  { x: -15, z: -10, w: 1,  h: 4.0,  d: 6   },
  // random scenery
  ...Array.from({ length: 20 }, () => ({
    x: (Math.random() - 0.5) * 180,
    z: (Math.random() - 0.5) * 180,
    w: Math.random() * 3 + 1,
    h: Math.random() * 5 + 1,
    d: Math.random() * 3 + 1,
  })),
]

for (const cfg of boxConfigs) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d),
    new THREE.MeshStandardMaterial({ color: 0x8b7355 }),
  )
  mesh.position.set(cfg.x, cfg.h / 2, cfg.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
  body.addShape(new CANNON.Box(new CANNON.Vec3(cfg.w / 2, cfg.h / 2, cfg.d / 2)))
  body.position.set(cfg.x, cfg.h / 2, cfg.z)
  physics.addBody(body)
}

// Stamina bar (minimal HUD — replaced by HUD.ts in later step)
const staminaEl = document.createElement('div')
Object.assign(staminaEl.style, {
  position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
  width: '180px', height: '6px', background: '#333', borderRadius: '3px', pointerEvents: 'none',
})
const staminaFill = document.createElement('div')
Object.assign(staminaFill.style, {
  height: '100%', background: '#4caf50', borderRadius: '3px', transition: 'width 0.1s',
})
staminaEl.appendChild(staminaFill)
document.body.appendChild(staminaEl)

const crosshair = document.createElement('div')
Object.assign(crosshair.style, {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  width: '4px', height: '4px', background: 'rgba(255,255,255,0.8)',
  borderRadius: '50%', pointerEvents: 'none',
})
document.body.appendChild(crosshair)

// ── Game loop ─────────────────────────────────────────────────────────────────

bus.on<number>('fixedUpdate', (dt) => {
  if (input.isPointerLocked()) {
    const { x, y } = input.flushMouseDelta()
    playerCam.applyMouseDelta(x, y)
  }

  physics.step(dt)
  player.update(dt)

  const basePos = player.getCameraBase()
  playerCam.update(dt, basePos, player.isMoving(), player.isSprinting(), player.getState())

  // Stamina HUD
  staminaFill.style.width = `${player.stamina}%`
  staminaFill.style.background = player.stamina < 25 ? '#f44336' : '#4caf50'
})

loop.start()
