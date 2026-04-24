const registry = new Map<string, unknown>()

export const ServiceLocator = {
  register<T>(key: string, service: T): void {
    registry.set(key, service)
  },

  get<T>(key: string): T {
    const service = registry.get(key)
    if (service === undefined) throw new Error(`Service not found: ${key}`)
    return service as T
  },

  has(key: string): boolean {
    return registry.has(key)
  },
}
