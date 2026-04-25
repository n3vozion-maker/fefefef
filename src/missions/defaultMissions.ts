import type { MissionData } from './Mission'

export const DEFAULT_MISSIONS: MissionData[] = [
  {
    id: 'mission_1',
    title: 'First Contact',
    description: 'Firebase Alpha has gone dark. Reach the base and neutralise their commander.',
    objectives: [
      { id: 'reach_base_alpha',       description: 'Reach Firebase Alpha',        status: 'inactive', optional: false },
      { id: 'eliminate_boss_alpha',   description: 'Neutralise the Commander',    status: 'inactive', optional: false },
    ],
  },
  {
    id: 'mission_2',
    title: 'Ghost Town',
    description: 'The Northern Ruins hold vital intelligence. Find the bunker entrance and secure the area.',
    objectives: [
      { id: 'reach_village_n',        description: 'Reach the Northern Ruins',    status: 'inactive', optional: false },
      { id: 'reach_bunker_a',         description: 'Locate Bunker Complex Alpha', status: 'inactive', optional: false },
    ],
  },
  {
    id: 'mission_3',
    title: 'Heavy Metal',
    description: 'Intel confirms a heavily armoured juggernaut at Firebase Bravo. Take it down.',
    objectives: [
      { id: 'reach_base_bravo',       description: 'Reach Firebase Bravo',        status: 'inactive', optional: false },
      { id: 'eliminate_boss_heavy',   description: 'Destroy the Heavy Unit',      status: 'inactive', optional: false },
    ],
  },
  {
    id: 'mission_4',
    title: 'Dead Drop',
    description: 'Three dead drops marked across the map. Reach all of them before enemy patrols move in.',
    objectives: [
      { id: 'reach_crash_d',          description: 'Secure Crash Site Delta',     status: 'inactive', optional: false },
      { id: 'reach_outpost_f',        description: 'Secure Outpost Foxtrot',      status: 'inactive', optional: false },
      { id: 'reach_bunker_cmd',       description: 'Reach Command Bunker',        status: 'inactive', optional: false },
    ],
  },
  {
    id: 'mission_5',
    title: 'Deep Facility',
    description: 'The deep facility to the south-west holds something dangerous. Investigate.',
    objectives: [
      { id: 'reach_bunker_deep',      description: 'Reach the Deep Facility',     status: 'inactive', optional: false },
      { id: 'reach_outpost_g',        description: 'Clear Outpost Golf',          status: 'inactive', optional: true  },
    ],
  },
]
