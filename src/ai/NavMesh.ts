export class NavMesh {
  async load(_url: string): Promise<void> {}
  queryClosestPoint(_x: number, _z: number): { x: number; z: number } | null { return null }
}
