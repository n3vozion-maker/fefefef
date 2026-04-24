import type * as THREE from 'three'

export interface PointOfInterest {
  id: string
  name: string
  position: THREE.Vector3Like
  fastTravel: boolean
}
