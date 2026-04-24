export class Chunk {
  constructor(public readonly cx: number, public readonly cz: number) {}
  load(): Promise<void> { return Promise.resolve() }
  unload(): void {}
}
