import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AssetCache } from './AssetCache'

const cache = new AssetCache()
const gltfLoader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()

export const AssetLoader = {
  async loadGLTF(path: string): Promise<GLTF> {
    const cached = cache.get<GLTF>(path)
    if (cached) return cached
    return new Promise((resolve, reject) => {
      gltfLoader.load(path, (gltf) => {
        cache.set(path, gltf, 1024 * 1024)
        resolve(gltf)
      }, undefined, reject)
    })
  },

  async loadTexture(path: string): Promise<THREE.Texture> {
    const cached = cache.get<THREE.Texture>(path)
    if (cached) return cached
    return new Promise((resolve, reject) => {
      textureLoader.load(path, (tex) => {
        cache.set(path, tex, 512 * 512 * 4)
        resolve(tex)
      }, undefined, reject)
    })
  },

  async loadAudio(path: string): Promise<AudioBuffer> {
    const cached = cache.get<AudioBuffer>(path)
    if (cached) return cached
    const res = await fetch(path)
    const buf = await res.arrayBuffer()
    const ctx = new AudioContext()
    const decoded = await ctx.decodeAudioData(buf)
    cache.set(path, decoded, buf.byteLength)
    return decoded
  },
}
