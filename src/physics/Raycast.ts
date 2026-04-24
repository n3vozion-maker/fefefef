import * as CANNON from 'cannon-es'
import type { PhysicsWorld } from './PhysicsWorld'

export interface RayHit {
  point: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  distance: number
  body: CANNON.Body | null
}

export class Raycast {
  constructor(private physics: PhysicsWorld) {}

  cast(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
  ): RayHit | null {
    const f = new CANNON.Vec3(from.x, from.y, from.z)
    const t = new CANNON.Vec3(to.x, to.y, to.z)
    const result = this.physics.raycast(f, t)
    if (!result) return null
    return {
      point: { x: result.hitPointWorld.x, y: result.hitPointWorld.y, z: result.hitPointWorld.z },
      normal: { x: result.hitNormalWorld.x, y: result.hitNormalWorld.y, z: result.hitNormalWorld.z },
      distance: result.distance,
      body: result.body,
    }
  }
}
