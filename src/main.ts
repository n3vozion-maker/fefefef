import * as THREE from 'three'

import { GameLoop }           from './core/GameLoop'
import { ServiceLocator }     from './core/ServiceLocator'
import { bus }                from './core/EventBus'
import { Renderer }           from './renderer/Renderer'
import { InputManager }       from './input/InputManager'
import { PhysicsWorld }       from './physics/PhysicsWorld'
import { Raycast }            from './physics/Raycast'
import { PlayerCamera }       from './player/PlayerCamera'
import { PlayerController }   from './player/PlayerController'
import { PlayerStats }        from './player/PlayerStats'
import { InteractionSystem }  from './player/InteractionSystem'
import { WorldManager }       from './world/WorldManager'
import { CheckpointManager }  from './persistence/CheckpointManager'
import { SaveSystem }         from './persistence/SaveSystem'
import { getTerrainHeight }   from './world/TerrainNoise'
import { CombatSystem }       from './combat/CombatSystem'
import { ExplosionSystem }    from './combat/ExplosionSystem'
import { GrenadeSystem }      from './combat/GrenadeSystem'
import { AISystem }           from './ai/AISystem'
import { BossAlpha }          from './ai/bosses/BossAlpha'
import { BossHeavy }          from './ai/bosses/BossHeavy'
import { FirearmWeapon }      from './weapons/FirearmWeapon'
import { WeaponManager }      from './weapons/WeaponManager'
import { Viewmodel }          from './weapons/Viewmodel'
import { HUD }                from './hud/HUD'
import { GameOverScreen }     from './hud/GameOverScreen'
import { PauseMenu }          from './hud/PauseMenu'
import { MissionSelectMenu }  from './hud/MissionSelectMenu'
import { MissionSystem }      from './missions/MissionSystem'
import { AudioSystem }        from './audio/AudioSystem'
import { DEFAULT_MISSIONS }   from './missions/defaultMissions'
import './weapons/loadDefinitions'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const renderer    = new Renderer()
const input       = new InputManager()
const physics     = new PhysicsWorld()
const playerCam   = new PlayerCamera(renderer.camera)
const playerStats = new PlayerStats()
const player      = new PlayerController(physics, input, playerCam)
const raycast     = new Raycast(physics)
const interact    = new InteractionSystem(player, raycast)
const world       = new WorldManager(renderer.scene, physics)
const combat      = new CombatSystem(physics, renderer.scene)
const explosions  = new ExplosionSystem(renderer.scene)
const grenades    = new GrenadeSystem(renderer.scene)
const ai          = new AISystem(renderer.scene, physics)
const weaponMgr   = new WeaponManager()
const viewmodel   = new Viewmodel(renderer.camera)
const missions    = new MissionSystem()
const audio       = new AudioSystem()
const hud         = new HUD()
const loop        = new GameLoop()

// Bosses (placed at their respective POI positions)
const bossAlpha   = new BossAlpha( 600, -400, physics)
const bossHeavy   = new BossHeavy(-700,  800, physics)

// Register services
ServiceLocator.register('renderer',   renderer)
ServiceLocator.register('input',      input)
ServiceLocator.register('physics',    physics)
ServiceLocator.register('player',     player)
ServiceLocator.register('world',      world)
ServiceLocator.register('weaponMgr',  weaponMgr)
ServiceLocator.register('missions',   missions)
ServiceLocator.register('audio',      audio)

// ── Missions ──────────────────────────────────────────────────────────────────

DEFAULT_MISSIONS.forEach(m => missions.load(m))
const missionMenu = new MissionSelectMenu(missions, DEFAULT_MISSIONS)

// ── Weapons ───────────────────────────────────────────────────────────────────

weaponMgr.equip(new FirearmWeapon('rifle_m4a1'), 0)
weaponMgr.equip(new FirearmWeapon('sniper_awp'), 1)
weaponMgr.equip(new FirearmWeapon('pistol_m9'),  2)
weaponMgr.init()
viewmodel.setWeapon(weaponMgr.activeWeapon())

bus.on('weaponSwitched', () => viewmodel.setWeapon(weaponMgr.activeWeapon()))

// ── Spawn / Persistence ───────────────────────────────────────────────────────

const spawnPlayer = (x = 0, z = 0): void => {
  const h = getTerrainHeight(x, z)
  player.body.position.set(x, h + 2.5, z)
  player.body.velocity.set(0, 0, 0)
  playerStats.respawn()
}

spawnPlayer()

const checkpoint = new CheckpointManager(() => ({
  playerPos: { x: player.body.position.x, y: player.body.position.y, z: player.body.position.z },
  health: playerStats.health, ammo: {}, missionId: null, completedObjectives: [], playtime: 0,
}))
checkpoint.init()

// ── Game over screen ──────────────────────────────────────────────────────────

const gameOver = new GameOverScreen(() => {
  const save = SaveSystem.load()
  if (save) {
    spawnPlayer(save.playerPos.x, save.playerPos.z)
  } else {
    spawnPlayer()
  }
})

// ── Pause menu ────────────────────────────────────────────────────────────────

const pauseMenu = new PauseMenu(() => {
  // After resume, player needs to click canvas to re-lock pointer
})

// ── Input / systems init ──────────────────────────────────────────────────────

input.init()
combat.init()

renderer.getCanvas().addEventListener('click', () => {
  if (!pauseMenu.paused && !gameOver.isVisible() && !missionMenu.isOpen()) {
    input.requestPointerLock(renderer.getCanvas())
  }
})

// ── Scene lighting ────────────────────────────────────────────────────────────

const { scene } = renderer
scene.background = new THREE.Color(0x87ceeb)
scene.fog = new THREE.FogExp2(0xb0cfe0, 0.00045)

const sun = new THREE.DirectionalLight(0xfff5e0, 2.2)
sun.position.set(600, 400, 300)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1; sun.shadow.camera.far = 1_200
sun.shadow.camera.left = sun.shadow.camera.bottom = -300
sun.shadow.camera.right = sun.shadow.camera.top   =  300
scene.add(sun)
scene.add(new THREE.AmbientLight(0x4060a0, 0.55))
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.4))

// Boss meshes
const mkBossMesh = (color: number, scale: number): THREE.Mesh => {
  const m = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.7, 2.0, 6, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
  )
  m.scale.setScalar(scale); m.castShadow = true; return m
}
bossAlpha.mesh = mkBossMesh(0x2a3a5a, 1.2); scene.add(bossAlpha.mesh)
bossHeavy.mesh = mkBossMesh(0x3a2a1a, 1.6); scene.add(bossHeavy.mesh)

// Lock prompt
const lockPrompt = document.createElement('div')
Object.assign(lockPrompt.style, {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  color: '#fff', fontFamily: 'monospace', fontSize: '13px',
  background: 'rgba(0,0,0,0.65)', padding: '12px 24px', borderRadius: '4px',
  pointerEvents: 'none', lineHeight: '1.8',
})
lockPrompt.innerHTML = 'Click to play<br><span style="font-size:11px;color:rgba(255,255,255,0.5)">WASD · Mouse · Shift sprint · C slide · Space jump/vault · G grenade · 1/2/3 weapons · M missions · ESC pause</span>'
document.body.appendChild(lockPrompt)

// Dev label
const devLabel = document.createElement('div')
Object.assign(devLabel.style, {
  position: 'fixed', top: '10px', left: '12px',
  color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '11px', pointerEvents: 'none',
})
document.body.appendChild(devLabel)

// ── Explosion → blast damage to nearby agents ─────────────────────────────────

bus.on<{ position: THREE.Vector3; radius: number; damage: number }>('blastDamage', (e) => {
  // Player damage check
  const pp = player.body.position
  const pd = e.position.distanceTo(new THREE.Vector3(pp.x, pp.y, pp.z))
  if (pd < e.radius) playerStats.applyDamage(e.damage * (1 - pd / e.radius))
})

// ── AI fire hits player ───────────────────────────────────────────────────────

bus.on<{ origin: THREE.Vector3; damage: number }>('aiWeaponFired', (e) => {
  const pp   = player.body.position
  const dist = e.origin.distanceTo(new THREE.Vector3(pp.x, pp.y, pp.z))
  if (dist < 45) playerStats.applyDamage(e.damage * Math.max(0, 1 - dist / 80))
})

// ── Game loop ─────────────────────────────────────────────────────────────────

let firing = false
bus.on<string>('actionDown', (a) => { if (a === 'fire') firing = true })
bus.on<string>('actionUp',   (a) => { if (a === 'fire') firing = false })

bus.on<number>('fixedUpdate', (dt) => {
  // Gate everything while paused, dead, or menus open
  if (pauseMenu.paused || gameOver.isVisible()) return

  const locked = input.isPointerLocked()
  lockPrompt.style.display = (locked || missionMenu.isOpen()) ? 'none' : ''

  if (locked) {
    const { x, y } = input.flushMouseDelta()
    playerCam.applyMouseDelta(x, y)
  }

  physics.step(dt)
  player.update(dt)
  playerStats.update(dt)
  weaponMgr.update(dt)
  combat.update(dt)
  explosions.update(dt)
  grenades.update(dt)

  // Grenade throw
  if (input.isHeld('grenade') && locked) {
    if (grenades.throw(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())) {
      // Consume the hold (single throw per press handled by actionDown debounce)
    }
  }

  // Firing
  const w = weaponMgr.activeWeapon()
  if (w && locked && !missionMenu.isOpen()) {
    const shouldFire = w.isAutomatic ? input.mouseButtons.left : firing
    if (shouldFire) {
      const fired = w.tryFire(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())
      if (fired) {
        playerCam.applyRecoil(w.recoilPitch, w.recoilYaw)
        viewmodel.flash()
        viewmodel.kick(w.recoilPitch, w.recoilYaw)
        firing = false
      }
    }
  }

  const playerPos = new THREE.Vector3(
    player.body.position.x, player.body.position.y, player.body.position.z,
  )

  world.update(playerPos, dt)
  ai.update(dt, playerPos)
  bossAlpha.update(dt, playerPos)
  bossHeavy.update(dt, playerPos)

  const basePos = player.getCameraBase()
  playerCam.update(dt, basePos, player.isMoving(), player.isSprinting(), player.getState())
  viewmodel.update(dt, weaponMgr.isADS(), w?.getIsReloading() ?? false)

  hud.update(w, playerStats, player.stamina)
  hud.tick(dt)

  const fwd = playerCam.getMuzzleDirection()
  audio.update({ x: playerPos.x, y: playerPos.y, z: playerPos.z }, { x: fwd.x, y: fwd.y, z: fwd.z })

  const p = player.body.position
  devLabel.textContent = `${player.getState().padEnd(8)} | ${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} | hp:${playerStats.health.toFixed(0)} | 🧨${grenades.count}`
})

// Grenade keybind — single throw per press (not hold)
bus.on<string>('actionDown', (a) => {
  if (a === 'grenade') {
    grenades.throw(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())
  }
})

loop.start()
