import type { NavMesh } from './NavMesh'

export type Path = { x: number; z: number }[]

export class Pathfinding {
  constructor(private navmesh: NavMesh) {}

  async findPath(_from: { x: number; z: number }, _to: { x: number; z: number }): Promise<Path> {
    void this.navmesh
    return []
  }
}
