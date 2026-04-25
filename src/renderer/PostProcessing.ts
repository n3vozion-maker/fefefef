import * as THREE from 'three'

// ── Lightweight post-processing via a full-screen quad shader ─────────────────
// Avoids the three/examples/jsm EffectComposer to keep the bundle lean.
// Implements: vignette + colour grading (contrast/saturation) on a 2D pass.

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`

const FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float     uVignette;
  uniform float     uContrast;
  uniform float     uSaturation;
  uniform float     uBrightness;
  varying vec2 vUv;

  vec3 saturation(vec3 c, float s) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(lum), c, s);
  }

  void main() {
    vec4 tex    = texture2D(tDiffuse, vUv);
    vec3 col    = tex.rgb;

    // Colour grade
    col = saturation(col, uSaturation);
    col = ((col - 0.5) * uContrast) + 0.5 + uBrightness;
    col = clamp(col, 0.0, 1.0);

    // Vignette
    vec2 uv2    = vUv - 0.5;
    float vign  = 1.0 - dot(uv2, uv2) * uVignette;
    col        *= vign;

    gl_FragColor = vec4(col, 1.0);
  }
`

export class PostProcessing {
  private target:  THREE.WebGLRenderTarget
  private quad:    THREE.Mesh
  private quadCam: THREE.OrthographicCamera
  private quadScene: THREE.Scene
  private uniforms: {
    tDiffuse:     { value: THREE.Texture | null }
    uVignette:    { value: number }
    uContrast:    { value: number }
    uSaturation:  { value: number }
    uBrightness:  { value: number }
  }

  constructor(private renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(
      renderer.domElement.width,
      renderer.domElement.height,
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter },
    )

    this.uniforms = {
      tDiffuse:    { value: null },
      uVignette:   { value: 2.2 },
      uContrast:   { value: 1.08 },
      uSaturation: { value: 1.15 },
      uBrightness: { value: 0.01 },
    }

    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    const geo = new THREE.PlaneGeometry(2, 2)
    this.quad  = new THREE.Mesh(geo, mat)

    this.quadScene = new THREE.Scene()
    this.quadScene.add(this.quad)

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  resize(w: number, h: number): void {
    this.target.setSize(w, h)
  }

  render(mainScene: THREE.Scene, camera: THREE.Camera): void {
    // 1. Render scene to offscreen target
    this.renderer.setRenderTarget(this.target)
    this.renderer.render(mainScene, camera)

    // 2. Post-process to screen
    this.uniforms.tDiffuse.value = this.target.texture
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCam)
  }

  dispose(): void {
    this.target.dispose()
  }
}
