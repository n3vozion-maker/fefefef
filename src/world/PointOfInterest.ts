export type POIType =
  | 'military_base'
  | 'abandoned_village'
  | 'bunker'
  | 'outpost'
  | 'crash_site'
  | 'checkpoint'
  | 'weapon_cache'
  | 'comm_tower'
  | 'airfield'
  | 'lab'

export interface PointOfInterest {
  id:          string
  name:        string
  type:        POIType
  x:           number
  z:           number
  radius:      number   // trigger/influence radius in metres
  discovered:  boolean
  fastTravel:  false    // no fast travel per spec
}

export const POI_DEFINITIONS: Readonly<PointOfInterest>[] = [
  // ── Military bases ────────────────────────────────────────────────────────
  { id: 'base_alpha',  name: 'Firebase Alpha',      type: 'military_base',    x:  600, z: -400, radius: 250, discovered: false, fastTravel: false },
  { id: 'base_bravo',  name: 'Firebase Bravo',       type: 'military_base',    x: -700, z:  800, radius: 250, discovered: false, fastTravel: false },

  // ── Abandoned villages ────────────────────────────────────────────────────
  { id: 'village_n',   name: 'Northern Ruins',       type: 'abandoned_village', x:  200, z:-1200, radius: 150, discovered: false, fastTravel: false },
  { id: 'village_e',   name: 'Eastern Settlement',   type: 'abandoned_village', x: 1100, z:  100, radius: 120, discovered: false, fastTravel: false },
  { id: 'village_w',   name: 'Western Village',      type: 'abandoned_village', x: -900, z: -200, radius: 130, discovered: false, fastTravel: false },
  { id: 'village_s',   name: 'Southern Hamlet',      type: 'abandoned_village', x:   50, z: 1300, radius: 110, discovered: false, fastTravel: false },

  // ── Bunkers ───────────────────────────────────────────────────────────────
  { id: 'bunker_a',    name: 'Bunker Complex Alpha',  type: 'bunker',           x: -300, z:  500, radius:  80, discovered: false, fastTravel: false },
  { id: 'bunker_cmd',  name: 'Command Bunker',         type: 'bunker',           x:  700, z: -700, radius:  80, discovered: false, fastTravel: false },
  { id: 'bunker_deep', name: 'Deep Facility',          type: 'bunker',           x: -1400, z: -900, radius: 70, discovered: false, fastTravel: false },

  // ── Outposts ──────────────────────────────────────────────────────────────
  { id: 'outpost_f',   name: 'Outpost Foxtrot',       type: 'outpost',          x:  900, z:  600, radius:  60, discovered: false, fastTravel: false },
  { id: 'outpost_g',   name: 'Outpost Golf',           type: 'outpost',          x: -200, z:-1400, radius:  60, discovered: false, fastTravel: false },
  { id: 'outpost_h',   name: 'Outpost Hotel',          type: 'outpost',          x:-1100, z:  400, radius:  55, discovered: false, fastTravel: false },

  // ── Crash sites ───────────────────────────────────────────────────────────
  { id: 'crash_d',     name: 'Crash Site Delta',       type: 'crash_site',       x:  400, z:  300, radius:  70, discovered: false, fastTravel: false },
  { id: 'crash_e',     name: 'Crash Site Echo',         type: 'crash_site',       x: -500, z: -800, radius:  70, discovered: false, fastTravel: false },
  { id: 'crash_z',     name: 'Crash Site Zulu',         type: 'crash_site',       x: 1300, z: -600, radius:  65, discovered: false, fastTravel: false },

  // ── Weapon caches ─────────────────────────────────────────────────────────
  { id: 'cache_a',   name: 'Weapons Cache — Alpha', type: 'weapon_cache', x:  340, z: -260, radius: 40, discovered: false, fastTravel: false },
  { id: 'cache_b',   name: 'Weapons Cache — Bravo', type: 'weapon_cache', x: -460, z:  640, radius: 40, discovered: false, fastTravel: false },
  { id: 'cache_c',   name: 'Weapons Cache — Gamma', type: 'weapon_cache', x:  820, z: -820, radius: 40, discovered: false, fastTravel: false },
  { id: 'cache_d',   name: 'Weapons Cache — Delta', type: 'weapon_cache', x: -740, z: -480, radius: 40, discovered: false, fastTravel: false },

  // ── Comms towers ──────────────────────────────────────────────────────────
  { id: 'tower_1',   name: 'Relay Tower 01',        type: 'comm_tower',   x:  160, z: -600, radius: 35, discovered: false, fastTravel: false },
  { id: 'tower_2',   name: 'Relay Tower 02',         type: 'comm_tower',   x: -540, z:  240, radius: 35, discovered: false, fastTravel: false },
  { id: 'tower_3',   name: 'Relay Tower 03',         type: 'comm_tower',   x:  960, z:  -80, radius: 35, discovered: false, fastTravel: false },

  // ── Airfield ──────────────────────────────────────────────────────────────
  { id: 'airfield_a', name: 'Abandoned Airfield',   type: 'airfield',     x: -1000, z: 1100, radius: 200, discovered: false, fastTravel: false },
  { id: 'airfield_b', name: 'Forward Air Base',     type: 'airfield',     x:  1400, z: -300, radius: 180, discovered: false, fastTravel: false },

  // ── Labs ──────────────────────────────────────────────────────────────────
  { id: 'lab_omega',  name: 'Lab OMEGA',            type: 'lab',          x: -1200, z: -1300, radius: 90, discovered: false, fastTravel: false },
  { id: 'lab_sigma',  name: 'Research Post SIGMA',  type: 'lab',          x:   600, z:  1000, radius: 70, discovered: false, fastTravel: false },

  // ── Additional outposts ───────────────────────────────────────────────────
  { id: 'outpost_j',  name: 'Outpost Juliet',       type: 'outpost',      x:  -80, z:  -700, radius: 55, discovered: false, fastTravel: false },
  { id: 'outpost_k',  name: 'Outpost Kilo',          type: 'outpost',      x:  520, z:   740, radius: 55, discovered: false, fastTravel: false },

  // ── Checkpoints (Dying Light safe houses) ─────────────────────────────────
  { id: 'cp_0',  name: 'Safe House — Spawn',     type: 'checkpoint', x:    0, z:    0, radius: 22, discovered: true,  fastTravel: false },
  { id: 'cp_1',  name: 'Safe House — Ridge',     type: 'checkpoint', x:  480, z: -180, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_2',  name: 'Safe House — Creek',     type: 'checkpoint', x: -380, z:  420, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_3',  name: 'Safe House — Plateau',   type: 'checkpoint', x:  180, z: -820, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_4',  name: 'Safe House — Overpass',  type: 'checkpoint', x: -620, z: -580, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_5',  name: 'Safe House — East Gate', type: 'checkpoint', x:  820, z:  280, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_6',  name: 'Safe House — Northwall', type: 'checkpoint', x: -100, z:  920, radius: 22, discovered: false, fastTravel: false },
  { id: 'cp_7',  name: 'Safe House — Summit',    type: 'checkpoint', x: -880, z: -1100, radius: 22, discovered: false, fastTravel: false },
]
