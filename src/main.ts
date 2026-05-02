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
import { BossVoss }           from './ai/bosses/BossVoss'
import { BossWraith }         from './ai/bosses/BossWraith'
import { BossIron7 }          from './ai/bosses/BossIron7'
import { BossPhantom }        from './ai/bosses/BossPhantom'
import { BossRex }            from './ai/bosses/BossRex'
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
import { DayNightSystem }     from './world/DayNightSystem'
import { AmmoPickupSystem }   from './world/AmmoPickup'
import { UnlockSystem }       from './persistence/UnlockSystem'
import { VehicleSystem }      from './vehicles/VehicleSystem'
import { WeaponLoadoutMenu }      from './hud/WeaponLoadoutMenu'
import { ConsumableInventory }    from './player/ConsumableInventory'
import { VehiclePickupSystem }    from './vehicles/VehiclePickups'
import { EndgameSystem }          from './missions/EndgameSystem'
import { Minimap }                from './hud/Minimap'
import { VictoryScreen }         from './hud/VictoryScreen'
import { ConfettiSystem }        from './effects/ConfettiSystem'
import { FlagWeapon }            from './weapons/FlagWeapon'
import { BloodSystem }           from './effects/BloodSystem'
import { TitleScreen }           from './hud/TitleScreen'
import { BossHealthBar }         from './hud/BossHealthBar'
import { DifficultySystem }      from './core/DifficultySystem'
import { SideQuestSystem }       from './missions/SideQuestSystem'
import { ChestSystem }           from './world/ChestSystem'
import { WaypointHUD, MISSION_POI, POI_REACH_RADIUS } from './hud/WaypointHUD'
import { SideQuestPanel }        from './hud/SideQuestPanel'
import { buildAllStructures }    from './world/WorldStructures'
import { buildVegetation }       from './world/VegetationSystem'
import { FullscreenMap }         from './hud/FullscreenMap'
import { CashSystem }            from './economy/CashSystem'
import { MissionBriefing }       from './hud/MissionBriefing'
import { DamageNumbers }         from './effects/DamageNumbers'
import { DropSystem }            from './world/DropSystem'
import { WeatherSystem }         from './world/WeatherSystem'
import { KillstreakSystem }      from './combat/KillstreakSystem'
import { UpgradeSystem }         from './player/UpgradeSystem'
import { AIGrenadeSystem }       from './ai/AIGrenadeSystem'
import { TracerSystem }          from './effects/TracerSystem'
import { setPlayerDamageMult }   from './combat/DamageCalculator'
import { KillcamSystem }         from './hud/KillcamSystem'
import { SettingsMenu }          from './hud/SettingsMenu'
import { ExplosiveBarrelSystem } from './world/ExplosiveBarrelSystem'
import { NightVisionSystem }     from './effects/NightVisionSystem'
import { ShellEjectionSystem }      from './effects/ShellEjectionSystem'
import { AirstrikeSystem }          from './combat/AirstrikeSystem'
import { DestructibleCoverSystem }  from './world/DestructibleCoverSystem'
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
const killcam     = new KillcamSystem(renderer.camera)
const settings    = new SettingsMenu(audio)
const loop        = new GameLoop()
const unlocks     = new UnlockSystem()
const ammoPickups = new AmmoPickupSystem(renderer.scene)
const vehicleSys  = new VehicleSystem(renderer.scene, physics, renderer.camera)
const cashSys        = new CashSystem()
const upgrades       = new UpgradeSystem()
const killstreaks    = new KillstreakSystem(cashSys)
const loadoutMenu    = new WeaponLoadoutMenu(weaponMgr, cashSys, grenades, upgrades)
void killstreaks
const consumables    = new ConsumableInventory()
const vehiclePickups = new VehiclePickupSystem(renderer.scene)
const endgame        = new EndgameSystem(unlocks)
const minimap        = new Minimap()
const fullMap        = new FullscreenMap()
const briefing       = new MissionBriefing()
const dmgNumbers     = new DamageNumbers(renderer.camera)
const drops          = new DropSystem(renderer.scene, cashSys)
void drops
const confetti       = new ConfettiSystem()
const victoryScreen  = new VictoryScreen()
void confetti   // listeners registered in constructor
void victoryScreen

// ── Bosses — one per mission ──────────────────────────────────────────────────
const bossVoss    = new BossVoss   ( 600, -400, physics)   // mission_1 Firebase Alpha
const bossWraith  = new BossWraith ( 200,-1180, physics)   // mission_2 Northern Ruins
const bossIron7   = new BossIron7  (-680,  820, physics)   // mission_3 Firebase Bravo
const bossPhantom = new BossPhantom( 750,  420, physics)   // mission_4 Dead Drop zone
const bossRex     = new BossRex    (-850, -700, physics)   // mission_5 Deep Facility

const bossHealthBar = new BossHealthBar()

// Register services
ServiceLocator.register('renderer',   renderer)
ServiceLocator.register('input',      input)
ServiceLocator.register('physics',    physics)
ServiceLocator.register('player',     player)
ServiceLocator.register('world',      world)
ServiceLocator.register('weaponMgr',  weaponMgr)
ServiceLocator.register('missions',   missions)
ServiceLocator.register('audio',      audio)
ServiceLocator.register('unlocks',    unlocks)
ServiceLocator.register('vehicles',   vehicleSys)

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
  health:              playerStats.health,
  ammo:                {},
  missionId:           missions.getActive()?.id ?? null,
  completedObjectives: missions.getCompletedObjectiveIds(),
  playtime:            0,
  timestamp:           Date.now(),
}))
checkpoint.init()

// Auto-checkpoint every time an objective completes
bus.on('objectiveCompleted', () => {
  // Small delay so mission state updates before we snapshot it
  setTimeout(() => {
    const pp = player.body.position
    SaveSystem.save({
      playerPos:           { x: pp.x, y: pp.y, z: pp.z },
      health:              playerStats.health,
      ammo:                {},
      missionId:           missions.getActive()?.id ?? null,
      completedObjectives: missions.getCompletedObjectiveIds(),
      playtime:            0,
      timestamp:           Date.now(),
    })
  }, 200)
})

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
  if (!pauseMenu.paused && !gameOver.isVisible() && !missionMenu.isOpen() && !loadoutMenu.isOpen()) {
    input.requestPointerLock(renderer.getCanvas())
  }
})

// BUG 1 fix: auto-request pointer lock when ENGAGE is clicked (user gesture)
bus.on('titleDismissed', () => input.requestPointerLock(renderer.getCanvas()))

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

const ambientLight = new THREE.AmbientLight(0x4060a0, 0.55)
const hemiLight    = new THREE.HemisphereLight(0x87ceeb, 0x3a5f3a, 0.4)
scene.add(ambientLight)
scene.add(hemiLight)

// ── Day/Night cycle ───────────────────────────────────────────────────────────

const dayNight = new DayNightSystem(sun, ambientLight, hemiLight, scene, scene.fog as THREE.FogExp2)
const weather  = new WeatherSystem(scene, scene.fog as THREE.FogExp2, renderer.camera)

// ── Player flashlight (auto-activates at night) ────────────────────────────────

const flashlight = new THREE.SpotLight(0xfff4e0, 0, 45, 0.32, 0.45, 1.6)
flashlight.castShadow = false
flashlight.position.set(0.15, -0.08, -0.2)
renderer.camera.add(flashlight)
renderer.camera.add(flashlight.target)
flashlight.target.position.set(0, 0, -1)
scene.add(renderer.camera)

// ── Boss meshes ───────────────────────────────────────────────────────────────
const allBosses = [bossVoss, bossWraith, bossIron7, bossPhantom, bossRex] as const
for (const boss of allBosses) {
  const mesh = boss.buildMesh()
  boss.mesh  = mesh
  scene.add(mesh)
}

// Blood + effects systems
const blood       = new BloodSystem(scene)
const aiGrenades  = new AIGrenadeSystem(scene)
const tracers     = new TracerSystem(scene)
const barrels     = new ExplosiveBarrelSystem(scene, physics)
const nightVision = new NightVisionSystem(renderer.getCanvas(), ambientLight, hemiLight)
const shells      = new ShellEjectionSystem(scene)
const airstrike   = new AirstrikeSystem(scene)
const cover       = new DestructibleCoverSystem(scene, physics)
void blood
void barrels
void nightVision
void shells
void cover

// Side quests + world chests + waypoints
const sqSystem    = new SideQuestSystem()
const chests      = new ChestSystem(scene)
const waypointHUD = new WaypointHUD()
const sqPanel     = new SideQuestPanel()

// Spawn a chest for every side quest
for (const q of sqSystem.quests) {
  chests.spawn(q.id, q.chestPos)
}
fullMap.setSQSystem(sqSystem)

// Show the first quest panel straight away
sqPanel.show(sqSystem.quests[0]!.title, sqSystem.quests[0]!.objectives[0]!.description)

// Title screen — gates gameplay until ENGAGE is pressed
const titleScreen = new TitleScreen()
void bossHealthBar

// ── World structures + vegetation ─────────────────────────────────────────────
buildAllStructures(renderer.scene, physics)
buildVegetation(renderer.scene)

// ── Vehicle spawns ────────────────────────────────────────────────────────────

vehicleSys.spawnMotorcycle( 15, 2, 10)
vehicleSys.spawnMotorcycle(-20, 2,  8)
vehicleSys.spawnCar(        30, 2, -5)
vehicleSys.spawnCar(       -35, 2, 12)
vehicleSys.spawnTank(      580, 2, -380)   // near base alpha
vehicleSys.spawnTank(     -700, 2,  800)   // near base bravo

// ── Ammo pickup clusters ──────────────────────────────────────────────────────

// Spawn at each major POI — y=2 approximate (terrain will vary slightly)
const ammoSites: [number, number, number][] = [
  [ 580, 2, -400],   // base alpha
  [-700, 2,  820],   // base bravo
  [ 200, 2,-1200],   // village north
  [1080, 2,  120],   // outpost east
  [-900, 2, -200],   // outpost west
  [  -0, 2,    0],   // spawn area
]
for (const [ax, , az] of ammoSites) {
  ammoPickups.spawnCluster(ax, getTerrainHeight(ax, az) + 0.5, az, 4)
}

// ── Vehicle pickup clusters (repair kits + fuel canisters) ────────────────────

const vehiclePickupSites: [number, number, number][] = [
  [  20, 2,   20],   // spawn
  [ 560, 2, -380],   // base alpha
  [-680, 2,  800],   // base bravo
  [ 200, 2,-1180],   // village N
  [1080, 2,  120],   // outpost E
  [-880, 2, -200],   // outpost W
  [  400, 2, 280],   // mid-map
  [ -350, 2, 530],   // mid-map W
]
for (const [vx, , vz] of vehiclePickupSites) {
  vehiclePickups.spawnCluster(vx, getTerrainHeight(vx, vz) + 0.5, vz)
}

// Lock prompt
const lockPrompt = document.createElement('div')
Object.assign(lockPrompt.style, {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  color: '#fff', fontFamily: 'monospace', fontSize: '13px',
  background: 'rgba(0,0,0,0.65)', padding: '12px 24px', borderRadius: '4px',
  pointerEvents: 'none', lineHeight: '1.8',
})
lockPrompt.innerHTML = 'Click to play<br><span style="font-size:11px;color:rgba(255,255,255,0.5)">WASD · Mouse · Shift sprint · C crouch · Z prone · Space jump/vault · Ctrl dash · Q parry · G grenade · Crouch+G airstrike · 1/2/3 weapons · Tab loadout · M missions · J side quests · E enter vehicle · F exit · N NV · I settings · ESC pause</span>'
document.body.appendChild(lockPrompt)

// Dev label (hidden by default — toggle with F3)
const devLabel = document.createElement('div')
Object.assign(devLabel.style, {
  position: 'fixed', top: '10px', left: '12px',
  color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: '11px',
  pointerEvents: 'none', display: 'none',
})
document.body.appendChild(devLabel)
document.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault()
    devLabel.style.display = devLabel.style.display === 'none' ? 'block' : 'none'
  }
})

// ── Explosion → blast damage to nearby agents ─────────────────────────────────

bus.on<{ position: THREE.Vector3; radius: number; damage: number }>('blastDamage', (e) => {
  // Player damage check — scaled by difficulty
  const pp = player.body.position
  const pd = e.position.distanceTo(new THREE.Vector3(pp.x, pp.y, pp.z))
  if (pd < e.radius) {
    playerStats.applyDamage(
      e.damage * (1 - pd / e.radius) * DifficultySystem.enemyDamageMult,
    )
  }
})

// ── AI fire hits player ───────────────────────────────────────────────────────

let lastKillerPos = new THREE.Vector3()

bus.on<{ origin: THREE.Vector3; damage: number }>('aiWeaponFired', (e) => {
  const pp   = player.body.position
  const dist = e.origin.distanceTo(new THREE.Vector3(pp.x, pp.y, pp.z))
  if (dist < 45) {
    lastKillerPos.copy(e.origin)
    playerStats.applyDamage(
      e.damage * Math.max(0, 1 - dist / 80) * DifficultySystem.enemyDamageMult * upgrades.armorMult,
    )
  }
})

bus.on('playerDied', () => killcam.trigger(lastKillerPos))

// ── Drop system ammo pickup → active weapon reserve ───────────────────────────

bus.on<{ amount: number }>('ammoDropPickup', (e) => {
  weaponMgr.activeWeapon()?.addReserve(e.amount)
  bus.emit('hudNotify', `+${e.amount} AMMO`)
})

// ── Enemy ammo drops → AmmoPickupSystem ──────────────────────────────────────

bus.on<{ position: THREE.Vector3; ammoType: string; amount: number }>('enemyAmmoDrop', (e) => {
  ammoPickups.spawn(e.position.x, e.position.y + 0.5, e.position.z, e.ammoType as 'rifle' | 'pistol' | 'sniper' | 'explosive')
})

// ── Blast damage to player vehicles ──────────────────────────────────────────

bus.on<{ position: THREE.Vector3; radius: number; damage: number }>('blastDamage', (e) => {
  const veh = vehicleSys.activeVehicle
  if (veh && veh.alive) {
    const d = veh.getPosition().distanceTo(e.position)
    if (d < e.radius) {
      veh.takeDamage(e.damage * (1 - d / e.radius))
    }
  }
})

// ── Tank cannon → world blast ─────────────────────────────────────────────────
// Project the shell 150 m along aim direction and detonate as blast damage

bus.on<{ origin: THREE.Vector3; direction: THREE.Vector3; damage: number }>('tankCannonFired', (e) => {
  const blastPos = e.origin.clone().addScaledVector(e.direction.normalize(), 150)
  bus.emit('explosion',   { position: blastPos })
  bus.emit('blastDamage', { position: blastPos, radius: 14, damage: e.damage })
})

// ── Vehicle repair / refuel with consumables ─────────────────────────────────

bus.on<string>('actionDown', (a) => {
  if (a !== 'interact') return
  const veh = vehicleSys.activeVehicle
  if (!veh) return
  if (veh.health < veh.maxHealth && consumables.repairKits > 0) {
    if (consumables.useRepairKit()) veh.repair(200)
  } else if (veh.fuel < veh.maxFuel && consumables.fuelCanisters > 0) {
    if (consumables.useFuelCanister()) veh.refuel(30)
  }
})

// ── Slow-mo on boss kill ──────────────────────────────────────────────────────

let timeScale   = 1
let slowMoTimer = 0

bus.on('bossDied', () => {
  hud.flashBossKill()
  timeScale   = 0.18
  slowMoTimer = 1.8
})

// ── Game loop ─────────────────────────────────────────────────────────────────

let firing       = false
let prevVehPos: THREE.Vector3 | null = null
bus.on<string>('actionDown', (a) => { if (a === 'fire') firing = true })
bus.on<string>('actionUp',   (a) => { if (a === 'fire') firing = false })

// ── Apply difficulty + restore checkpoint when ENGAGE is pressed ──────────────
// ── Sandbox mode — fires after all missions + all GHOST SUPPLY quests ─────────
bus.on('endgameStarted', () => {
  // Show persistent SANDBOX badge in top-left
  const badge = document.createElement('div')
  Object.assign(badge.style, {
    position:      'fixed',
    top:           '10px',
    left:          '50%',
    transform:     'translateX(-50%)',
    fontFamily:    'monospace',
    fontSize:      '9px',
    letterSpacing: '.22em',
    color:         'rgba(255,215,0,0.55)',
    pointerEvents: 'none',
    zIndex:        '50',
    userSelect:    'none',
    textTransform: 'uppercase',
  })
  badge.textContent = '— SANDBOX MODE —'
  document.body.appendChild(badge)

  // Extra vehicle spawns scattered across the map
  vehicleSys.spawnMotorcycle( 320,  2,  680)
  vehicleSys.spawnMotorcycle(-980,  2,  380)
  vehicleSys.spawnCar(        880,  2, -820)
  vehicleSys.spawnCar(       -100,  2, -900)
  vehicleSys.spawnCar(        200,  2,  980)
  vehicleSys.spawnCar(       1200,  2,  -80)
  vehicleSys.spawnTank(       750,  2,  420)
  vehicleSys.spawnTank(      -600,  2, -550)

  // Extra infantry groups spread across the open map
  ai.spawnReinforcement(  320,  680, 4)
  ai.spawnReinforcement( -980,  380, 4)
  ai.spawnReinforcement(  880, -820, 4)
  ai.spawnReinforcement( -100, -900, 4)
  ai.spawnReinforcement(  200,  980, 4)
  ai.spawnReinforcement( 1200,  -80, 4)
  ai.spawnReinforcement( -600, -550, 5)
  ai.spawnReinforcement(  750,  420, 5)
})

bus.on('upgradeApplied', () => {
  playerStats.maxHealth  = DifficultySystem.config.playerMaxHp + upgrades.healthBonus
  player.maxStamina      = 100 + upgrades.staminaBonus
  setPlayerDamageMult(upgrades.damageMult)
})

bus.on('gameStarted', () => {
  const cfg = DifficultySystem.config

  // Apply upgrade bonuses on top of difficulty baseline
  playerStats.maxHealth = cfg.playerMaxHp + upgrades.healthBonus
  playerStats.health    = playerStats.maxHealth
  player.maxStamina     = 100 + upgrades.staminaBonus
  setPlayerDamageMult(upgrades.damageMult)

  // Scale all infantry health
  for (const agent of ai.getAgents()) {
    agent.health = Math.round(agent.health * cfg.enemyHpMult)
  }
  // Scale special enemies
  for (const e of ai.getSpecialEnemies()) {
    e.hp = Math.round(e.hp * cfg.enemyHpMult)
  }

  // Scale boss health
  for (const boss of allBosses) {
    const scaled    = Math.round(boss.maxHealth * cfg.bossHpMult)
    boss.health     = scaled
    boss.maxHealth  = scaled
  }

  // Restore checkpoint if one exists
  const save = SaveSystem.load()
  if (save) {
    spawnPlayer(save.playerPos.x, save.playerPos.z)
    playerStats.health = Math.min(save.health, cfg.playerMaxHp)
    if (save.missionId) {
      missions.restore(save.missionId, save.completedObjectives)
    }
  }
})

// ── Boss reinforcement → spawn real infantry agents near boss ─────────────────
bus.on<{ origin: THREE.Vector3; count: number }>('bossReinforce', (e) => {
  ai.spawnReinforcement(e.origin.x, e.origin.z, e.count)
})

// ── Side quest panel updates ───────────────────────────────────────────────────
bus.on<{ id: string; title: string }>('sqStarted', (e) => {
  const q = sqSystem.quests.find(x => x.id === e.id)
  if (q) sqPanel.show(q.title, q.objectives[0]?.description ?? '')
})
bus.on('sqObjectiveUpdated', () => {
  sqPanel.setObjective(sqSystem.getCurrentObjDesc())
})

bus.on<number>('fixedUpdate', (dt) => {
  killcam.update(dt)   // always runs — drives the delayed game-over

  // Gate everything while paused, dead, killcam/settings active, title screen showing, menus open, or map open
  if (pauseMenu.paused || gameOver.isVisible() || killcam.isActive() || settings.isOpen() || !titleScreen.isDismissed() || fullMap.isOpen()) return

  // Slow-mo tick
  if (slowMoTimer > 0) {
    slowMoTimer -= dt
    if (slowMoTimer <= 0) timeScale = 1
  }
  const gameDt = dt * timeScale

  const locked = input.isPointerLocked()
  const menuOpen = missionMenu.isOpen() || loadoutMenu.isOpen() || settings.isOpen()
  lockPrompt.style.display = (locked || menuOpen) ? 'none' : ''
  minimap.setVisible(locked && !menuOpen)

  if (locked) {
    const { x, y } = input.flushMouseDelta()
    playerCam.applyMouseDelta(x, y)
  }

  physics.step(gameDt)
  player.update(gameDt)
  playerStats.update(gameDt)
  weaponMgr.update(gameDt)
  combat.update(gameDt)
  explosions.update(gameDt)
  grenades.update(gameDt)

  // Grenade / airstrike
  if (input.isHeld('grenade') && locked) {
    if (player.isCrouching() && airstrike.available) {
      // Crouch + G = airstrike smoke flare at 60 m ahead
      const target = playerCam.getMuzzleOrigin()
        .addScaledVector(playerCam.getMuzzleDirection(), 60)
      airstrike.call(target)
      bus.emit('airstrikeIncoming', {})
    } else {
      grenades.throw(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())
    }
  }

  // Firing
  const w = weaponMgr.activeWeapon()
  if (w && locked && !menuOpen) {
    const shouldFire = w.isAutomatic ? input.mouseButtons.left : firing
    if (shouldFire) {
      const fired = w.tryFire(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())
      if (fired) {
        const proneMult = player.isProne() ? 0.15 : 1
        playerCam.applyRecoil(w.recoilPitch * proneMult, w.recoilYaw * proneMult)
        viewmodel.flash()
        viewmodel.kick(w.recoilPitch * proneMult, w.recoilYaw * proneMult)
        firing = false
      }
    }
  }

  const playerPos = new THREE.Vector3(
    player.body.position.x, player.body.position.y, player.body.position.z,
  )

  world.update(playerPos, gameDt)
  ai.update(gameDt, playerPos)
  for (const boss of allBosses) boss.update(gameDt, playerPos)
  aiGrenades.update(gameDt)
  tracers.update(dt)
  blood.update(dt)
  shells.update(gameDt)
  airstrike.update(gameDt)
  cover.update(gameDt)

  // ── Chest / vehicle interaction prompt ───────────────────────────────────
  const chestPrompt = chests.update(dt, playerPos)
  const nearVehicle = !vehicleSys.isOccupied && vehicleSys.getNearestDistance(playerPos) < 4.5
  const interactText = chestPrompt
    ?? (nearVehicle ? '[E]  Enter vehicle' : null)
  hud.updateInteractPrompt(interactText)

  // ── Side quest tick ───────────────────────────────────────────────────────
  sqSystem.tickPlayerPos(playerPos)
  if (sqPanel.isVisible()) sqPanel.setObjective(sqSystem.getCurrentObjDesc())

  // ── Main mission POI proximity detection ──────────────────────────────────
  const activeMission = missions.getActive()
  if (activeMission) {
    for (const obj of activeMission.objectives) {
      if (obj.status !== 'active') continue
      const poi = MISSION_POI[obj.id]
      if (!poi) continue
      const dx = poi.x - playerPos.x
      const dz = poi.z - playerPos.z
      if (dx * dx + dz * dz < POI_REACH_RADIUS * POI_REACH_RADIUS) {
        bus.emit('poiDiscovered', { id: obj.id })
      }
    }
  }

  // ── Waypoint HUD ──────────────────────────────────────────────────────────
  // Priority: active main-mission reach objective, then side quest
  let wpTarget: THREE.Vector3 | null = null
  let wpLabel  = ''

  if (activeMission) {
    for (const obj of activeMission.objectives) {
      if (obj.status !== 'active') continue
      const poi = MISSION_POI[obj.id]
      if (poi) { wpTarget = poi; wpLabel = obj.description; break }
    }
  }
  if (!wpTarget) {
    wpTarget = sqSystem.getWaypoint()
    wpLabel  = sqSystem.getCurrentObjDesc()
  }
  waypointHUD.tick(playerPos, playerCam.getYaw(), wpTarget, wpLabel)

  minimap.update(dt, playerPos, playerCam.getYaw(), ai.getAgentPositions(), wpTarget)
  fullMap.update(dt, playerPos, playerCam.getYaw(), ai.getAgentPositions())

  // Day/night, weather, ammo, vehicles, endgame
  dayNight.update(dt)
  weather.update(dt, playerPos)
  briefing.update(dt)
  dmgNumbers.update(dt)
  drops.update(dt, playerPos)

  // Flashlight: ramp in as night falls (brightness < 0.25 → full on)
  const bright = dayNight.brightness
  flashlight.intensity = bright < 0.25
    ? THREE.MathUtils.lerp(9, 0, bright / 0.25)
    : 0

  ammoPickups.update(dt, playerPos)
  vehiclePickups.update(dt, playerPos, consumables)
  endgame.update(dt, playerPos)
  vehicleSys.update(
    gameDt,
    input.isHeld('moveForward'), input.isHeld('moveBack'),
    input.isHeld('moveLeft'),    input.isHeld('moveRight'),
    input.mouseButtons.left,     input.mouseButtons.right,
    playerPos, player.body,
    playerCam.getYaw(), playerCam.getPitch(),
  )

  // Only drive first-person camera when not in a vehicle
  const inVehicle = vehicleSys.isOccupied
  if (!inVehicle) {
    const basePos = player.getCameraBase()
    playerCam.update(gameDt, basePos, player.isMoving(), player.isSprinting(), player.getState())
  }

  // Vehicle engine pitch
  const activeVeh = vehicleSys.activeVehicle
  if (activeVeh && inVehicle) {
    const curPos = activeVeh.getPosition()
    if (prevVehPos) {
      const speed = prevVehPos.distanceTo(curPos) / Math.max(dt, 0.001)
      audio.updateEngineSpeed(speed)
    }
    prevVehPos = curPos.clone()
  } else {
    prevVehPos = null
  }

  // Footstep sounds
  const grounded = player.getState() !== 'air'
  audio.tickFootsteps(player.isMoving() && !inVehicle, grounded, player.isSprinting(), dt)

  viewmodel.update(dt, weaponMgr.isADS(), w?.getIsReloading() ?? false)

  hud.update(w, playerStats, player.stamina, player.tech)
  hud.tick(dt, (playerStats.health / playerStats.maxHealth) * 100)

  const fwd = playerCam.getMuzzleDirection()
  audio.update({ x: playerPos.x, y: playerPos.y, z: playerPos.z }, { x: fwd.x, y: fwd.y, z: fwd.z }, dt)

  const p = player.body.position
  const phase = dayNight.phase
  const veh = vehicleSys.activeVehicle
  const vehStr = veh ? ` | ${veh.type} hp:${veh.health.toFixed(0)} fuel:${veh.fuel.toFixed(0)}` : ''
  devLabel.textContent = `${player.getState().padEnd(8)} | ${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} | hp:${playerStats.health.toFixed(0)} | 🧨${grenades.count} | ${phase} | dash:${player.tech.charges}/${player.tech.chargeMax} | 🔧${consumables.repairKits} ⛽${consumables.fuelCanisters}${vehStr}`
})

// Grenade keybind — single throw per press (not hold)
bus.on<string>('actionDown', (a) => {
  if (a === 'grenade') {
    grenades.throw(playerCam.getMuzzleOrigin(), playerCam.getMuzzleDirection())
  }

  // Vehicle enter (E) / exit (F)
  if (a === 'interact') {
    const pp  = player.body.position
    const pos = new THREE.Vector3(pp.x, pp.y, pp.z)
    chests.tryInteract(pos)
    if (!vehicleSys.isOccupied) vehicleSys.tryEnter(pos)
  }
  if (a === 'vehicleExit' && vehicleSys.isOccupied) {
    vehicleSys.tryExit(player.body)
  }
})

loop.start()
