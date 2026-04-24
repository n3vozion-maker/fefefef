import * as CANNON from 'cannon-es'

export class PhysicsWorld {
  readonly world: CANNON.World

  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -25, 0) })
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = true

    const ground = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
    ground.addShape(new CANNON.Plane())
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(ground)
  }

  step(dt: number): void {
    this.world.step(1 / 60, dt, 3)
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body)
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body)
  }

  raycast(from: CANNON.Vec3, to: CANNON.Vec3): CANNON.RaycastResult | null {
    const result = new CANNON.RaycastResult()
    const hit = this.world.raycastClosest(from, to, {}, result)
    return hit ? result : null
  }
}
