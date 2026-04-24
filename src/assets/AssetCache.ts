const BUDGET_BYTES = 512 * 1024 * 1024

export class AssetCache {
  private cache = new Map<string, { value: unknown; size: number; lastUsed: number }>()
  private usedBytes = 0

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    entry.lastUsed = Date.now()
    return entry.value as T
  }

  set(key: string, value: unknown, size: number): void {
    this.evictIfNeeded(size)
    this.cache.set(key, { value, size, lastUsed: Date.now() })
    this.usedBytes += size
  }

  private evictIfNeeded(incoming: number): void {
    if (this.usedBytes + incoming <= BUDGET_BYTES) return
    const sorted = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
    for (const [key, entry] of sorted) {
      this.cache.delete(key)
      this.usedBytes -= entry.size
      if (this.usedBytes + incoming <= BUDGET_BYTES) break
    }
  }
}
