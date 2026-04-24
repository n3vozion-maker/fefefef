import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { getTerrainHeight, getVegetationDensity } from './TerrainNoise'
import { getBiome, getBiomeColor } from './BiomeSystem'
import type { PhysicsWorld } from '../physics/PhysicsWorld'

export const CHUNK_SIZE = 256   // metres

// Vertex segments per LOD level
const LOD_SEGS = [64, 16, 4] as const  // near / mid / far

// ── Shared prop geometries (created once) ────────────────────────────────────

let _treeTrunk: THREE.CylinderGeometry | null = null
let _treeTop:   THREE.ConeGeometry     | null = null
let _rockGeo:   THREE.IcosahedronGeometry | null = null

function treeTrunkGeo():  THREE.CylinderGeometry    { return _treeTrunk ??= new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6) }
function treeTopGeo():    THREE.ConeGeometry          { return _treeTop   ??= new THREE.ConeGeometry(1.6, 4.5, 7) }
function rockGeo():       THREE.IcosahedronGeometry   { return _rockGeo   ??= new THREE.IcosahedronGeometry(1, 0) }

const MAT_TRUNK = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.9 })
const MAT_PINE  = new THREE.MeshStandardMaterial({ color: 0x274d1c, roughness: 0.8 })
const MAT_ROCK  = new THREE.MeshStandardMaterial({ color: 0x888070, roughness: 1.0 })

// ── Chunk ─────────────────────────────────────────────────────────────────────

export type LODLevel = 0 | 1 | 2

export class Chunk {
  readonly cx: number
  readonly cz: number

  private terrainMesh: THREE.Mesh | null = null
  private propMeshes:  THREE.Mesh[]      = []
  private physicsBody: CANNON.Body | null = null

  private currentLOD: LODLevel = 2
  private loaded = false

  constructor(cx: number, cz: number) {
    this.cx = cx
    this.cz = cz
  }

  /** World-space X of chunk's south-west corner */
  get worldX(): number { return this.cx * CHUNK_SIZE }
  /** World-space Z of chunk's south-west corner */
  get worldZ(): number { return this.cz * CHUNK_SIZE }

  async load(lod: LODLevel, scene: THREE.Scene, physics: PhysicsWorld): Promise<void> {
    if (this.loaded && this.currentLOD === lod) return
    this.unload(scene, physics)

    this.currentLOD = lod
    this.loaded     = true

    this.buildTerrain(lod, scene)
    if (lod === 0) this.buildPhysics(physics)
    if (lod === 0) this.buildProps(scene)
  }

  unload(scene: THREE.Scene, physics: PhysicsWorld): void {
    if (this.terrainMesh) { scene.remove(this.terrainMesh); this.terrainMesh.geometry.dispose(); this.terrainMesh = null }
    for (const m of this.propMeshes) { scene.remove(m); m.geometry.dispose() }
    this.propMeshes = []
    if (this.physicsBody) { physics.removeBody(this.physicsBody); this.physicsBody = null }
    this.loaded = false
  }

  // ── Terrain mesh ────────────────────────────────────────────────────────────

  private buildTerrain(lod: LODLevel, scene: THREE.Scene): void {
    const segs = LOD_SEGS[lod]
    const geo  = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segs, segs)
    geo.rotateX(-Math.PI / 2)

    const pos    = geo.attributes['position'] as THREE.BufferAttribute
    const count  = pos.count
    const colors = new Float32Array(count * 3)

    const wx0 = this.worldX
    const wz0 = this.worldZ

    for (let i = 0; i < count; i++) {
      // PlaneGeometry vertices go from -size/2 to +size/2 in local space
      const lx = pos.getX(i)
      const lz = pos.getZ(i)
      const wx = wx0 + lx + CHUNK_SIZE / 2
      const wz = wz0 + lz + CHUNK_SIZE / 2

      const h = getTerrainHeight(wx, wz)
      pos.setY(i, h)

      const biome = getBiome(wx, wz)
      const c     = getBiomeColor(biome, h)
      colors[i * 3]     = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    pos.needsUpdate = true
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mat  = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(wx0 + CHUNK_SIZE / 2, 0, wz0 + CHUNK_SIZE / 2)
    mesh.receiveShadow = lod === 0
    mesh.castShadow    = false

    this.terrainMesh = mesh
    scene.add(mesh)
  }

  // ── Physics (LOD 0 only) ────────────────────────────────────────────────────

  private buildPhysics(physics: PhysicsWorld): void {
    const geo = this.terrainMesh?.geometry
    if (!geo) return

    const pos     = geo.attributes['position'] as THREE.BufferAttribute
    const idxAttr = geo.index
    if (!idxAttr) return

    const verts   = Array.from(pos.array as Float32Array)
    const indices = Array.from(idxAttr.array as Uint32Array | Uint16Array)

    // Offset vertices to world space (mesh centre offset already baked in via mesh.position)
    const cx = this.worldX + CHUNK_SIZE / 2
    const cz = this.worldZ + CHUNK_SIZE / 2
    for (let i = 0; i < verts.length; i += 3) {
      verts[i]!     += cx
      verts[i + 2]! += cz
    }

    const shape = new CANNON.Trimesh(verts, indices)
    const body  = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    body.addShape(shape)
    this.physicsBody = body
    physics.addBody(body)
  }

  // ── Props (LOD 0 only) ──────────────────────────────────────────────────────

  private buildProps(scene: THREE.Scene): void {
    const wx0 = this.worldX
    const wz0 = this.worldZ
    const rng  = seededRng(this.cx * 7919 + this.cz * 6271)

    const propCount = 40
    for (let i = 0; i < propCount; i++) {
      const lx   = (rng() - 0.5) * CHUNK_SIZE
      const lz   = (rng() - 0.5) * CHUNK_SIZE
      const wx   = wx0 + lx + CHUNK_SIZE / 2
      const wz   = wz0 + lz + CHUNK_SIZE / 2
      const h    = getTerrainHeight(wx, wz)
      const biome = getBiome(wx, wz)
      const dens  = getVegetationDensity(wx, wz)

      if (biome === 'urban') continue

      if ((biome === 'forest' && rng() < 0.8) || (biome === 'plains' && rng() < 0.15 && dens > 0.4)) {
        this.spawnTree(scene, wx, h, wz, rng)
      } else if (biome === 'mountain' && rng() < 0.4) {
        this.spawnRock(scene, wx, h, wz, rng)
      } else if (biome === 'snow' && rng() < 0.2) {
        this.spawnRock(scene, wx, h, wz, rng)
      }
    }
  }

  private spawnTree(scene: THREE.Scene, wx: number, wy: number, wz: number, rng: () => number): void {
    const scale = 0.7 + rng() * 0.8
    const rot   = rng() * Math.PI * 2

    const trunk = new THREE.Mesh(treeTrunkGeo(), MAT_TRUNK)
    trunk.position.set(wx, wy + 1.1 * scale, wz)
    trunk.scale.setScalar(scale)
    trunk.castShadow = true
    scene.add(trunk)
    this.propMeshes.push(trunk)

    const top = new THREE.Mesh(treeTopGeo(), MAT_PINE)
    top.position.set(wx, wy + 2.2 * scale + 2.25 * scale, wz)
    top.rotation.y = rot
    top.scale.setScalar(scale)
    top.castShadow = true
    scene.add(top)
    this.propMeshes.push(top)
  }

  private spawnRock(scene: THREE.Scene, wx: number, wy: number, wz: number, rng: () => number): void {
    const s = 0.4 + rng() * 1.6
    const rock = new THREE.Mesh(rockGeo(), MAT_ROCK)
    rock.position.set(wx, wy + s * 0.5, wz)
    rock.scale.set(s, s * (0.5 + rng() * 0.5), s)
    rock.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4)
    rock.castShadow = true
    scene.add(rock)
    this.propMeshes.push(rock)
  }
}

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff
  }
}
