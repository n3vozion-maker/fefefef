import { Chunk, type LODLevel } from './Chunk'
import type { PhysicsWorld }   from '../physics/PhysicsWorld'
import type * as THREE         from 'three'

interface LoadRequest {
  chunk: Chunk
  lod:   LODLevel
}

export class ChunkLoader {
  private queue:   LoadRequest[] = []
  private loading  = false

  /** Enqueue a chunk for async loading. Near chunks are prioritised. */
  enqueue(chunk: Chunk, lod: LODLevel): void {
    // Replace existing request for same chunk
    const idx = this.queue.findIndex(r => r.chunk === chunk)
    if (idx !== -1) this.queue.splice(idx, 1)

    if (lod === 0) {
      this.queue.unshift({ chunk, lod })   // near chunks go to front
    } else {
      this.queue.push({ chunk, lod })
    }

    if (!this.loading) this.flush()
  }

  private flush(): void {
    if (this.queue.length === 0) { this.loading = false; return }
    this.loading = true
    const req = this.queue.shift()!

    // Yield to the browser between chunks to avoid frame drops
    setTimeout(() => {
      // Chunk.load is sync-ish (CPU-bound generation), wrapped in promise for queue safety
      void this.doLoad(req).then(() => this.flush())
    }, 0)
  }

  private async doLoad(req: LoadRequest): Promise<void> {
    await req.chunk.load(req.lod, this._scene!, this._physics!)
  }

  // Injected after construction to keep ChunkLoader decoupled
  private _scene:   THREE.Scene   | null = null
  private _physics: PhysicsWorld  | null = null

  init(scene: THREE.Scene, physics: PhysicsWorld): void {
    this._scene   = scene
    this._physics = physics
  }
}
