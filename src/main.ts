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
import { PlayerStats }       from './player/PlayerStats'
import { InteractionSystem } from './player/InteractionSystem'
import { WorldManager }      from './world/WorldManager'
import { CheckpointManager } from './persistence/CheckpointManager'
import { getTerrainHeight }  from './world/TerrainNoise'
import { CombatSystem }      from './combat/CombatSystem'
import { AISystem }          from './ai/AISystem'
import { FirearmWeapon }     from './weapons/FirearmWeapon'
import { WeaponManager }     from './weapons/WeaponManager'
import { Viewmodel }         from './weapons/Viewmodel'
import { HUD }               from './hud/HUD'
import './weapons/loadDefinitions'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const renderer     = new Renderer()
const input        = new InputManager()
const physics      = new PhysicsWorld()
const playerCam    = new PlayerCamera(renderer.camera)
const playerStats  = new PlayerStats()
const player       = new PlayerController(physics, input, playerCam)
const raycast      = new Raycast(physics)
const interact     = new InteractionSystem(player, raycast)
const world        = new WorldManager(renderer.scene, physics)
const combat       = new CombatSystem(physics, renderer.scene)
const ai           = new AISystem(renderer.scene, physics)
const weaponMgr    = new WeaponManager()
const viewmodel    = new Viewmodel(renderer.camera)
const hud          = new HUD()
const loop         = new GameLoop()

ServiceLocator.register('renderer',   renderer)
ServiceLocator.register('input',      input)
ServiceLocator.register('physics',    physics)
ServiceLocator.register('player',     player)
ServiceLocator.register('world',      world)
ServiceLocator.register('weaponMgr',  weaponMgr)

// ── Weapons ───────────────────────────────────────────────────────────────────

const m4   = new FirearmWeapon('rifle_m4a1')
const awp  = new FirearmWeapon('sniper_awp')
const m9   = new FirearmWeapon('pistol_m9')
weaponMgr.equip(m4,  0)
weaponMgr.equip(awp, 1)
weaponMgr.equip(m9,  2)
weaponMgr.init()
viewmodel.setWeapon(m4)

bus.on<{ slot: number; weapon: unknown }>('weaponSwitched', (e) => {
  viewmodel.setWeapon(weaponMgr.activeWeapon())
  void e
})

// ── Spawn ─────────────────────────────────────────────────────────────────────

const spawnH = getTerrainHeight(0, 0)
player.body.position.set(0, spawnH + 2.5, 0)

// ── Persistence ───────────────────────────────────────────────────────────────

const checkpoint = new CheckpointManager(() => ({
  playerPos: { x: player.body.position.x, y: player.body.position.y, z: player.body.position.z },
  health: playerStats.health, ammo: {}, missionId: null, completedObjectives: [], playtime: 0,
}))
checkpoint.init()

// ── Input / systems init ──────────────────────────────────────────────────────

input.init()
combat.init()

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
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.4))

// Lock prompt
const lockPrompt = document.createElement('div')
Object.assign(lockPrompt.style, {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  color: '#fff', fontFamily: 'monospace', fontSize: '15px',
  background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: '4px', pointerEvents: 'none',
})
lockPrompt.textContent = 'Click to play   [ WASD · Mouse · Shift sprint · C slide · Space vault/jump · 1/2/3 weapons · R reload ]'
document.body.appendChild(lockPrompt)

// Dev info
const devLabel = document.createElement('div')
Object.assign(devLabel.style, {
  position: 'fixed', top: '10px', left: '12px', color: 'rgba(255,255,255,0.45)',
  fontFamily: 'monospace', fontSize: '11px', pointerEvents: 'none',
})
document.body.appendChild(devLabel)

// ── Player damage from AI ─────────────────────────────────────────────────────

bus.on<{ agentId: string; origin: THREE.Vector3; direction: THREE.Vector3; damage: number }>(
  'aiWeaponFired',
  (e) => {
    // Simple: check if ray hits near player position
    const pPos = player.body.position
    const dx   = e.origin.x - pPos.x
    const dy   = e.origin.y - pPos.y
    const dz   = e.origin.z - pPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    // Accuracy check (enemy shots have spread built in)
    if (dist < 40) {
      playerStats.applyDamage(e.damage * (1 - dist / 80))
    }
  }
)

// ── Game loop ─────────────────────────────────────────────────────────────────

let firing = false

bus.on<string>('actionDown', (a) => { if (a === 'fire') firing = true  })
bus.on<string>('actionUp',   (a) => { if (a === 'fire') firing = false })

bus.on<number>('fixedUpdate', (dt) => {
  const locked = input.isPointerLocked()
  lockPrompt.style.display = locked ? 'none' : ''

  if (locked) {
    const { x, y } = input.flushMouseDelta()
    playerCam.applyMouseDelta(x, y)
  }

  physics.step(dt)
  player.update(dt)
  weaponMgr.update(dt)
  combat.update(dt)

  // Firing
  const w = weaponMgr.activeWeapon()
  if (w && locked) {
    const shouldFire = w.isAutomatic ? input.mouseButtons.left : firing
    if (shouldFire) {
      const origin = playerCam.getMuzzleOrigin()
      const dir    = playerCam.getMuzzleDirection()
      const fired  = w.tryFire(origin, dir)
      if (fired) {
        playerCam.applyRecoil(w.recoilPitch, w.recoilYaw)
        viewmodel.flash()
        viewmodel.kick(w.recoilPitch, w.recoilYaw)
        firing = false   // reset for semi-auto gating; auto re-fires via mouseButtons.left
      }
    }
  }

  const playerPos = new THREE.Vector3(
    player.body.position.x,
    player.body.position.y,
    player.body.position.z,
  )

  world.update(playerPos, dt)
  ai.update(dt, playerPos)

  const basePos = player.getCameraBase()
  playerCam.update(dt, basePos, player.isMoving(), player.isSprinting(), player.getState())
  viewmodel.update(dt, weaponMgr.isADS(), w?.getIsReloading() ?? false)

  hud.update(w, playerStats, player.stamina)
  hud.tick(dt)

  const p = player.body.position
  devLabel.textContent =
    `${player.getState().padEnd(8)} | ` +
    `${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} | ` +
    `hp:${playerStats.health.toFixed(0)}`
})

loop.start()
