import * as THREE from 'three'
import { bus }    from '../core/EventBus'

interface Chest {
  questId: string
  group:   THREE.Group
  lid:     THREE.Mesh
  light:   THREE.PointLight
  pos:     THREE.Vector3
  opened:  boolean
}

export class ChestSystem {
  private chests: Chest[] = []

  constructor(private scene: THREE.Scene) {}

  spawn(questId: string, pos: THREE.Vector3): void {
    const group = new THREE.Group()

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color:            0x7a5c1e,
      roughness:        0.75,
      metalness:        0.15,
      emissive:         new THREE.Color(0xffaa00),
      emissiveIntensity:0.35,
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.55), bodyMat)
    body.position.y = 0.25
    body.castShadow = true
    group.add(body)

    // Metal banding strips
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 })
    for (const bx of [-0.3, 0.3]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.58), bandMat)
      band.position.set(bx, 0.25, 0)
      group.add(band)
    }

    // Lid (pivot from back edge)
    const lidMat  = new THREE.MeshStandardMaterial({
      color:            0x7a5c1e,
      roughness:        0.75,
      metalness:        0.15,
      emissive:         new THREE.Color(0xffaa00),
      emissiveIntensity:0.35,
    })
    const lidGeo  = new THREE.BoxGeometry(0.85, 0.18, 0.55)
    const lid     = new THREE.Mesh(lidGeo, lidMat)
    // Lid pivot is at the back; shift geometry forward so it rotates correctly
    lid.geometry.translate(0, 0, 0.275)
    lid.position.set(0, 0.5, -0.275)
    lid.castShadow = true
    group.add(lid)

    // Glow light
    const light = new THREE.PointLight(0xffaa00, 2.2, 6)
    group.add(light)

    group.position.copy(pos)
    this.scene.add(group)

    this.chests.push({ questId, group, lid, light, pos: pos.clone(), opened: false })
  }

  /** Call every frame. Returns a prompt string when the player is close enough. */
  update(dt: number, playerPos: THREE.Vector3): string | null {
    void dt
    let prompt: string | null = null
    const t = performance.now() * 0.001

    for (const chest of this.chests) {
      if (chest.opened) continue

      // Idle bob
      chest.group.position.y = chest.pos.y + Math.sin(t * 1.8) * 0.04

      // Pulse emissive
      const intensity = 0.28 + 0.18 * Math.sin(t * 2.6);
      (chest.lid.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity

      const dist = chest.pos.distanceTo(playerPos)
      if (dist < 4.5) prompt = '[E]  Open cache'
    }
    return prompt
  }

  /** Try to open a chest within interact range. Called on 'interact' action. */
  tryInteract(playerPos: THREE.Vector3): void {
    for (const chest of this.chests) {
      if (chest.opened) continue
      if (chest.pos.distanceTo(playerPos) < 4.5) {
        this.open(chest)
        return
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private open(chest: Chest): void {
    chest.opened = true
    chest.light.intensity = 0

    // Animate lid opening over ~0.55 s
    let progress = 0
    const step = (): void => {
      progress += 0.035
      chest.lid.rotation.x = -Math.PI * 0.7 * Math.min(progress, 1)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)

    bus.emit('sqChestOpened', chest.questId)
    bus.emit('ammoPickup',    {})   // play pickup sound
    bus.emit('hudNotify',     '\u2726 WEAPON FOUND')
  }
}
