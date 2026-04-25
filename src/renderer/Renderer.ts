import * as THREE from 'three'
import { bus }          from '../core/EventBus'
import { PostProcessing } from './PostProcessing'

export class Renderer {
  readonly scene:  THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private webgl:   THREE.WebGLRenderer
  private canvas:  HTMLCanvasElement
  private post:    PostProcessing

  constructor() {
    this.canvas = document.createElement('canvas')
    document.body.appendChild(this.canvas)

    this.webgl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.webgl.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.webgl.shadowMap.enabled = true
    this.webgl.shadowMap.type    = THREE.PCFSoftShadowMap
    this.webgl.toneMapping       = THREE.ACESFilmicToneMapping
    this.webgl.toneMappingExposure = 1.0

    this.scene  = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 1200)
    this.camera.position.set(0, 1.7, 0)

    this.post = new PostProcessing(this.webgl)

    this.resize()
    window.addEventListener('resize', this.resize)

    bus.on('render', () => this.render())
  }

  getCanvas(): HTMLCanvasElement { return this.canvas }

  private resize = (): void => {
    this.webgl.setSize(innerWidth, innerHeight)
    this.post.resize(innerWidth * Math.min(devicePixelRatio, 2), innerHeight * Math.min(devicePixelRatio, 2))
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
  }

  private render(): void {
    this.post.render(this.scene, this.camera)
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    this.post.dispose()
    this.webgl.dispose()
    this.canvas.remove()
  }
}
