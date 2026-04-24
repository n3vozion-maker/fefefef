import * as THREE from 'three'
import { bus } from '../core/EventBus'

export class Renderer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private webgl: THREE.WebGLRenderer
  private canvas: HTMLCanvasElement

  constructor() {
    this.canvas = document.createElement('canvas')
    document.body.appendChild(this.canvas)

    this.webgl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.webgl.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.webgl.shadowMap.enabled = true
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping
    this.webgl.toneMappingExposure = 1.0

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 800)

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1000)
    this.camera.position.set(0, 1.7, 0)

    this.resize()
    window.addEventListener('resize', this.resize)

    bus.on('render', () => this.render())
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  private resize = (): void => {
    this.webgl.setSize(innerWidth, innerHeight)
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
  }

  private render(): void {
    this.webgl.render(this.scene, this.camera)
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    this.webgl.dispose()
    this.canvas.remove()
  }
}
