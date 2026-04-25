import * as THREE from 'three'
import type { PhysicsWorld } from '../physics/PhysicsWorld'
import * as CANNON from 'cannon-es'

export type AlertState = 'unaware' | 'suspicious' | 'combat'

const SIGHT_RANGE   = 45    // m
const SIGHT_ANGLE   = 100   // degrees total FOV
const HEAR_RADIUS   = 18    // m — hears gunfire/footsteps

export class SensorSystem {
  constructor(private physics: PhysicsWorld) {}

  check(
    agentPos:  THREE.Vector3,
    agentDir:  THREE.Vector3,   // normalised forward vector
    playerPos: THREE.Vector3,
    current:   AlertState,
  ): AlertState {
    const toPlayer = playerPos.clone().sub(agentPos)
    const dist     = toPlayer.length()

    if (dist > SIGHT_RANGE) {
      // Hearing only works when in suspicious/combat and player is close enough
      return dist < HEAR_RADIUS && current !== 'unaware' ? current : 'unaware'
    }

    // Angle check
    const angle = THREE.MathUtils.radToDeg(
      Math.acos(Math.max(-1, Math.min(1, agentDir.dot(toPlayer.clone().normalize())))),
    )
    if (angle > SIGHT_ANGLE / 2) return current === 'combat' ? 'suspicious' : 'unaware'

    // Line-of-sight raycast
    const from = new CANNON.Vec3(agentPos.x, agentPos.y + 0.8, agentPos.z)
    const to   = new CANNON.Vec3(playerPos.x, playerPos.y + 1.0, playerPos.z)
    const hit  = this.physics.raycast(from, to)

    if (hit && (hit.body as unknown as Record<string,unknown>)['agentId']) {
      // Hit another agent — blocked
      return current
    }

    // Check if hit point is close to player (didn't hit a wall first)
    if (hit) {
      const hitPt = new THREE.Vector3(hit.hitPointWorld.x, hit.hitPointWorld.y, hit.hitPointWorld.z)
      if (hitPt.distanceTo(playerPos) > 2) return current === 'combat' ? 'suspicious' : 'unaware'
    }

    // Clear sight
    return dist < 10 ? 'combat' : 'suspicious'
  }
}
