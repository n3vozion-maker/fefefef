import * as THREE from 'three'
import { Chunk, CHUNK_SIZE, type LODLevel } from './Chunk'
import { ChunkLoader }                       from './ChunkLoader'
import { POI_DEFINITIONS, type PointOfInterest } from './PointOfInterest'
import type { PhysicsWorld }                 from '../physics/PhysicsWorld'
import { bus }                               from '../core/EventBus'

// ── Ring radii (in chunk units) ───────────────────────────────────────────────
//   LOD 0 (full):  2 chunk radius  →  512 m
//   LOD 1 (mid):   4 chunk radius  → 1024 m
//   LOD 2 (far):   7 chunk radius  → 1792 m

const NEAR_R =  2
const MID_R  =  4
const FAR_R  =  7

const MAP_MIN = -8   // chunk coordinate bounds (−2048 m)
const MAP_MAX =  7   // ( +2048 m)

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }

export class WorldManager {
  private chunks    = new Map<string, Chunk>()
  private loader:   ChunkLoader
  private scene:    THREE.Scene
  private physics:  PhysicsWorld
  private pois:     PointOfInterest[]
  private triggered = new Set<string>()

  private lastPlayerCX = Infinity
  private lastPlayerCZ = Infinity
  private updateTimer  = 0

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene   = scene
    this.physics = physics
    this.loader  = new ChunkLoader()
    this.loader.init(scene, physics)
    this.pois    = POI_DEFINITIONS.map(p => ({ ...p }))
  }

  update(playerPos: THREE.Vector3, dt: number): void {
    this.updateTimer += dt
    if (this.updateTimer < 0.5) {
      this.checkPOIs(playerPos)
      return
    }
    this.updateTimer = 0

    const pcx = Math.floor(playerPos.x / CHUNK_SIZE)
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE)

    if (pcx !== this.lastPlayerCX || pcz !== this.lastPlayerCZ) {
      this.lastPlayerCX = pcx
      this.lastPlayerCZ = pcz
      this.refreshChunks(pcx, pcz)
    }

    this.checkPOIs(playerPos)
  }

  getPOIs(): PointOfInterest[] { return this.pois }

  // ── Private ─────────────────────────────────────────────────────────────────

  private refreshChunks(pcx: number, pcz: number): void {
    const desired = new Map<string, LODLevel>()

    for (let dx = -FAR_R; dx <= FAR_R; dx++) {
      for (let dz = -FAR_R; dz <= FAR_R; dz++) {
        const cx = clamp(pcx + dx, MAP_MIN, MAP_MAX)
        const cz = clamp(pcz + dz, MAP_MIN, MAP_MAX)
        const key = `${cx},${cz}`
        const d   = Math.max(Math.abs(dx), Math.abs(dz))  // Chebyshev distance

        const lod: LODLevel = d <= NEAR_R ? 0 : d <= MID_R ? 1 : 2
        // Keep best (lowest) LOD if already in desired set
        const prev = desired.get(key)
        if (prev === undefined || lod < prev) desired.set(key, lod)
      }
    }

    // Unload out-of-range chunks
    for (const [key, chunk] of this.chunks) {
      if (!desired.has(key)) {
        chunk.unload(this.scene, this.physics)
        this.chunks.delete(key)
      }
    }

    // Load or upgrade chunks
    for (const [key, lod] of desired) {
      let chunk = this.chunks.get(key)
      if (!chunk) {
        const [cxStr, czStr] = key.split(',') as [string, string]
        chunk = new Chunk(Number(cxStr), Number(czStr))
        this.chunks.set(key, chunk)
      }
      this.loader.enqueue(chunk, lod)
    }
  }

  private checkPOIs(playerPos: THREE.Vector3): void {
    for (const poi of this.pois) {
      const dx = playerPos.x - poi.x
      const dz = playerPos.z - poi.z
      const inRange = dx * dx + dz * dz < poi.radius * poi.radius

      if (inRange && !this.triggered.has(poi.id)) {
        this.triggered.add(poi.id)
        poi.discovered = true
        bus.emit('poiDiscovered', poi)

        if (poi.type === 'checkpoint') {
          bus.emit('enterCheckpoint', poi)
          this.showCheckpointHUD(poi.name)
        }
      }

      if (!inRange && this.triggered.has(poi.id)) {
        this.triggered.delete(poi.id)
      }
    }
  }

  private showCheckpointHUD(name: string): void {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.65)', color: '#c8e6c9', fontFamily: 'monospace',
      fontSize: '15px', padding: '10px 22px', borderLeft: '3px solid #66bb6a',
      letterSpacing: '0.08em', pointerEvents: 'none', opacity: '1',
      transition: 'opacity 1s', whiteSpace: 'nowrap',
    })
    el.textContent = `✓  ${name} — progress saved`
    document.body.appendChild(el)
    setTimeout(() => { el.style.opacity = '0' }, 2_500)
    setTimeout(() => el.remove(), 3_600)
  }
}
