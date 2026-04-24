import * as THREE from 'three'
import { GameLoop } from './core/GameLoop'
import { ServiceLocator } from './core/ServiceLocator'
import { Renderer } from './renderer/Renderer'
import { InputManager } from './input/InputManager'

// --- Bootstrap ---

const renderer = new Renderer()
const input = new InputManager()
const loop = new GameLoop()

ServiceLocator.register('renderer', renderer)
ServiceLocator.register('input', input)

input.init()

// Request pointer lock on first click
renderer.getCanvas().addEventListener('click', () => {
  input.requestPointerLock(renderer.getCanvas())
}, { once: false })

// --- Temporary test scene (replaced by WorldManager in Step 3) ---

const { scene, camera } = renderer

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshStandardMaterial({ color: 0x3a5f3a, roughness: 0.9 }),
)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Grid helper for orientation
scene.add(new THREE.GridHelper(500, 50, 0x444444, 0x444444))

// Some reference boxes
for (let i = 0; i < 20; i++) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2, Math.random() * 5 + 1, 2),
    new THREE.MeshStandardMaterial({ color: 0x8b7355 }),
  )
  box.position.set((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200)
  box.position.y = box.geometry.parameters.height / 2
  box.castShadow = true
  box.receiveShadow = true
  scene.add(box)
}

// Lighting
const sun = new THREE.DirectionalLight(0xfff5e0, 2)
sun.position.set(50, 100, 30)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 0.5
sun.shadow.camera.far = 500
sun.shadow.camera.left = -100
sun.shadow.camera.right = 100
sun.shadow.camera.top = 100
sun.shadow.camera.bottom = -100
scene.add(sun)
scene.add(new THREE.AmbientLight(0x304060, 0.6))
scene.background = new THREE.Color(0x87ceeb)

// --- Free-look camera controller (temp, replaced by PlayerController in Step 2) ---

const euler = new THREE.Euler(0, 0, 0, 'YXZ')
const LOOK_SPEED = 0.002
const MOVE_SPEED = 8

let lastFixedDt = 1 / 60

import { bus } from './core/EventBus'

bus.on<number>('fixedUpdate', (dt) => {
  lastFixedDt = dt

  const mouse = input.flushMouseDelta()
  if (input.isPointerLocked()) {
    euler.y -= mouse.x * LOOK_SPEED
    euler.x -= mouse.y * LOOK_SPEED
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x))
    camera.quaternion.setFromEuler(euler)
  }

  const dir = new THREE.Vector3()
  if (input.isHeld('moveForward')) dir.z -= 1
  if (input.isHeld('moveBack'))    dir.z += 1
  if (input.isHeld('moveLeft'))    dir.x -= 1
  if (input.isHeld('moveRight'))   dir.x += 1
  if (dir.lengthSq() > 0) dir.normalize()

  const speed = input.isHeld('sprint') ? MOVE_SPEED * 2 : MOVE_SPEED
  dir.applyEuler(new THREE.Euler(0, euler.y, 0))
  camera.position.addScaledVector(dir, speed * dt)

  if (input.isHeld('jump')) camera.position.y += speed * dt
  if (input.isHeld('crouch')) camera.position.y -= speed * dt
  camera.position.y = Math.max(0.5, camera.position.y)
})

loop.start()
