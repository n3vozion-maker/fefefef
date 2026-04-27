import * as THREE from 'three'
import { bus }    from '../core/EventBus'

// ── Types ─────────────────────────────────────────────────────────────────────

type ObjType = 'reach' | 'kills' | 'chest'

interface SQObjective {
  id:          string
  type:        ObjType
  description: string   // live — updated with kill counts
  baseKills:   number   // required; 0 for non-kill types
  killedSoFar: number
  target?:     THREE.Vector3  // reach
  range:       number
}

export interface SideQuest {
  id:            string
  title:         string
  briefing:      string
  objectives:    SQObjective[]
  rewardWeapon:  string
  chestPos:      THREE.Vector3
  status:        'locked' | 'active' | 'complete'
  currentObjIdx: number
}

// ── Quest definitions — GHOST SUPPLY arc ──────────────────────────────────────

function makeQuests(): SideQuest[] {
  return [
    {
      id: 'sq_1', title: 'DEAD TRADE', status: 'active', currentObjIdx: 0,
      briefing: 'A contact went silent near Outpost West. Intel suggests he found a weapons shipment. Move to his last known position and secure the cache before enemy scouts do.',
      rewardWeapon: 'shotgun_aa12',
      chestPos: new THREE.Vector3(-910, 1, -230),
      objectives: [
        { id: 'sq1_reach', type: 'reach', description: 'Reach the drop zone',
          baseKills: 0, killedSoFar: 0,
          target: new THREE.Vector3(-920, 0, -220), range: 28 },
        { id: 'sq1_kills', type: 'kills', description: 'Eliminate the mercenary guards (0/4)',
          baseKills: 4, killedSoFar: 0, range: 0 },
        { id: 'sq1_chest', type: 'chest', description: 'Secure the weapons cache',
          baseKills: 0, killedSoFar: 0, range: 0 },
      ],
    },
    {
      id: 'sq_2', title: 'SIGNAL LOST', status: 'locked', currentObjIdx: 0,
      briefing: 'An encrypted distress signal is broadcasting from near the northern village. Weapons cache at the source — move before enemy scouts do.',
      rewardWeapon: 'smg_p90',
      chestPos: new THREE.Vector3(190, 1, -1200),
      objectives: [
        { id: 'sq2_reach', type: 'reach', description: 'Track the signal source',
          baseKills: 0, killedSoFar: 0,
          target: new THREE.Vector3(180, 0, -1210), range: 28 },
        { id: 'sq2_kills', type: 'kills', description: 'Eliminate the ambush (0/5)',
          baseKills: 5, killedSoFar: 0, range: 0 },
        { id: 'sq2_chest', type: 'chest', description: 'Secure the weapons cache',
          baseKills: 0, killedSoFar: 0, range: 0 },
      ],
    },
    {
      id: 'sq_3', title: 'HEADHUNTER', status: 'locked', currentObjIdx: 0,
      briefing: "Sniper codenamed VIPER has been terminating allied scouts from the eastern ridge. He covers SPECTER's supply routes. Terminate with extreme prejudice.",
      rewardWeapon: 'sniper_dragunov',
      chestPos: new THREE.Vector3(1070, 1, 130),
      objectives: [
        { id: 'sq3_reach', type: 'reach', description: 'Move to the eastern ridge',
          baseKills: 0, killedSoFar: 0,
          target: new THREE.Vector3(1060, 0, 140), range: 28 },
        { id: 'sq3_kills', type: 'kills', description: 'Eliminate VIPER and his guards (0/4)',
          baseKills: 4, killedSoFar: 0, range: 0 },
        { id: 'sq3_chest', type: 'chest', description: 'Retrieve the intel package',
          baseKills: 0, killedSoFar: 0, range: 0 },
      ],
    },
    {
      id: 'sq_4', title: 'IRON VAULT', status: 'locked', currentObjIdx: 0,
      briefing: "SPECTER's main weapons depot is buried beneath the southern marshes. Breach the perimeter, eliminate the guards, and take what's inside.",
      rewardWeapon: 'rifle_scar',
      chestPos: new THREE.Vector3(-505, 1, -800),
      objectives: [
        { id: 'sq4_reach', type: 'reach', description: 'Breach the depot perimeter',
          baseKills: 0, killedSoFar: 0,
          target: new THREE.Vector3(-500, 0, -790), range: 28 },
        { id: 'sq4_kills', type: 'kills', description: 'Clear the depot guards (0/6)',
          baseKills: 6, killedSoFar: 0, range: 0 },
        { id: 'sq4_chest', type: 'chest', description: 'Crack the vault',
          baseKills: 0, killedSoFar: 0, range: 0 },
      ],
    },
    {
      id: 'sq_5', title: 'ZERO HOUR', status: 'locked', currentObjIdx: 0,
      briefing: "SPECTER has surfaced. He's running his last supply convoy through the central sector. Intercept the convoy, eliminate his escort, and claim his weapon. This ends tonight.",
      rewardWeapon: 'lmg_m249',
      chestPos: new THREE.Vector3(400, 1, 310),
      objectives: [
        { id: 'sq5_reach', type: 'reach', description: 'Intercept the convoy',
          baseKills: 0, killedSoFar: 0,
          target: new THREE.Vector3(390, 0, 300), range: 28 },
        { id: 'sq5_kills', type: 'kills', description: "Eliminate SPECTER's escort (0/6)",
          baseKills: 6, killedSoFar: 0, range: 0 },
        { id: 'sq5_chest', type: 'chest', description: "Claim SPECTER's weapon",
          baseKills: 0, killedSoFar: 0, range: 0 },
      ],
    },
  ]
}

// ── SideQuestSystem ───────────────────────────────────────────────────────────

export class SideQuestSystem {
  readonly quests: SideQuest[]
  private _active: SideQuest | null

  constructor() {
    this.quests  = makeQuests()
    this._active = this.quests[0]!

    // Emit briefing after a short delay so HUD is ready
    setTimeout(() => {
      if (this._active) this.broadcastStart(this._active)
    }, 4000)

    bus.on('agentDied', () => this.onKill())
    bus.on('bossDied',  () => this.onKill())
    bus.on<string>('sqChestOpened', (id) => this.onChestOpened(id))
  }

  get active(): SideQuest | null { return this._active }

  /** World position the waypoint should point at right now. */
  getWaypoint(): THREE.Vector3 | null {
    if (!this._active) return null
    const obj = this.currentObj()
    if (!obj) return null
    if (obj.type === 'reach')          return obj.target ?? null
    if (obj.type === 'chest')          return this._active.chestPos
    // kills phase — point toward chest area as a general zone marker
    return this._active.chestPos
  }

  getCurrentObjDesc(): string {
    const obj = this.currentObj()
    return obj?.description ?? ''
  }

  /** Call every frame to check proximity for reach objectives. */
  tickPlayerPos(playerPos: THREE.Vector3): void {
    if (!this._active) return
    const obj = this.currentObj()
    if (!obj || obj.type !== 'reach' || !obj.target) return
    const flat = new THREE.Vector3(playerPos.x, 0, playerPos.z)
    const tgt  = new THREE.Vector3(obj.target.x, 0, obj.target.z)
    if (flat.distanceTo(tgt) < obj.range) {
      this.advance()
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private currentObj(): SQObjective | undefined {
    return this._active?.objectives[this._active.currentObjIdx]
  }

  private onKill(): void {
    if (!this._active) return
    const obj = this.currentObj()
    if (!obj || obj.type !== 'kills') return

    obj.killedSoFar = Math.min(obj.killedSoFar + 1, obj.baseKills)
    obj.description = obj.description.replace(
      /\(\d+\/\d+\)/,
      `(${obj.killedSoFar}/${obj.baseKills})`,
    )
    bus.emit('sqObjectiveUpdated', this._active.id)

    if (obj.killedSoFar >= obj.baseKills) this.advance()
  }

  private onChestOpened(questId: string): void {
    if (!this._active || this._active.id !== questId) return
    const obj = this.currentObj()
    if (!obj || obj.type !== 'chest') return
    this.completeQuest()
  }

  private advance(): void {
    if (!this._active) return
    this._active.currentObjIdx++
    const next = this.currentObj()
    if (next) {
      bus.emit('hudNotify', `► ${next.description}`)
      bus.emit('sqObjectiveUpdated', this._active.id)
    }
  }

  private completeQuest(): void {
    if (!this._active) return
    const q = this._active
    q.status = 'complete'

    bus.emit('weaponUnlocked', { weaponId: q.rewardWeapon })
    bus.emit('sqCompleted', q.id)
    bus.emit('hudNotify', `\u2713 SIDE QUEST COMPLETE: ${q.title}`)

    const idx  = this.quests.indexOf(q)
    const next = this.quests[idx + 1]
    if (next) {
      next.status  = 'active'
      this._active = next
      setTimeout(() => {
        this.broadcastStart(next)
      }, 3500)
    } else {
      this._active = null
    }
  }

  private broadcastStart(q: SideQuest): void {
    bus.emit('sqStarted', { id: q.id, title: q.title, briefing: q.briefing })
    bus.emit('hudNotify', `SIDE QUEST: ${q.title}`)
  }
}
