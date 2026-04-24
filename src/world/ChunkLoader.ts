import { Chunk } from './Chunk'

export class ChunkLoader {
  async load(_cx: number, _cz: number): Promise<Chunk> {
    return new Chunk(_cx, _cz)
  }
}
