import * as THREE from 'three'
import { bus }    from '../core/EventBus'

export class NightVisionSystem {
  private active   = false
  private scanline: HTMLElement
  private vignette: HTMLElement
  private grain:    HTMLElement
  private indicator: HTMLElement
  private grainAnim = 0

  constructor(
    private canvas:   HTMLCanvasElement,
    private ambient:  THREE.AmbientLight,
    private hemi:     THREE.HemisphereLight,
  ) {
    this.scanline  = this.buildScanline()
    this.vignette  = this.buildVignette()
    this.grain     = this.buildGrain()
    this.indicator = this.buildIndicator()

    bus.on<string>('actionDown', (a) => {
      if (a === 'nightVision') this.toggle()
    })
  }

  isActive(): boolean { return this.active }

  private toggle(): void {
    this.active = !this.active
    if (this.active) this.enable()
    else             this.disable()
    bus.emit('nvChanged', this.active)
  }

  private enable(): void {
    // Green phosphor filter — stronger and grainier
    this.canvas.style.filter =
      'sepia(1) saturate(6) hue-rotate(82deg) brightness(3.2) contrast(1.25)'

    // Significant ambient boost so darkness is navigable
    this.ambient.intensity += 1.10
    this.ambient.color.setHex(0x00ff44)
    this.hemi.intensity    += 0.55
    this.hemi.color.setHex(0x00ee33)

    this.scanline.style.display  = 'block'
    this.vignette.style.display  = 'block'
    this.grain.style.display     = 'block'
    this.indicator.style.display = 'block'
  }

  private disable(): void {
    this.canvas.style.filter = ''

    this.ambient.intensity -= 1.10
    this.ambient.color.setHex(0x4060a0)
    this.hemi.intensity    -= 0.55
    this.hemi.color.setHex(0x87ceeb)

    this.scanline.style.display  = 'none'
    this.vignette.style.display  = 'none'
    this.grain.style.display     = 'none'
    this.indicator.style.display = 'none'
  }

  /** Call each frame to animate the NV grain texture. */
  update(_dt: number): void {
    if (!this.active) return
    this.grainAnim++
    if (this.grainAnim % 2 === 0) {
      const ox = Math.floor(Math.random() * 200)
      const oy = Math.floor(Math.random() * 200)
      this.grain.style.backgroundPosition = `${ox}px ${oy}px`
    }
  }

  // ── DOM elements ─────────────────────────────────────────────────────────────

  private buildScanline(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:       'fixed',
      inset:          '0',
      pointerEvents:  'none',
      display:        'none',
      zIndex:         '12',
      backgroundImage:
        'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 3px)',
    })
    document.body.appendChild(el)
    return el
  }

  private buildVignette(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:       'fixed',
      inset:          '0',
      pointerEvents:  'none',
      display:        'none',
      zIndex:         '13',
      background:
        'radial-gradient(ellipse at center, transparent 42%, rgba(0,10,0,0.88) 100%)',
    })
    document.body.appendChild(el)
    return el
  }

  private buildGrain(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:        'fixed',
      inset:           '0',
      pointerEvents:   'none',
      display:         'none',
      zIndex:          '14',
      opacity:         '0.08',
      // SVG noise pattern as data URI
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize:  '200px 200px',
    })
    document.body.appendChild(el)
    return el
  }

  private buildIndicator(): HTMLElement {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position:      'fixed',
      top:           '14px',
      right:         '14px',
      display:       'none',
      pointerEvents: 'none',
      zIndex:        '14',
      fontFamily:    'monospace',
      fontSize:      '9px',
      letterSpacing: '0.28em',
      color:         'rgba(0,255,80,0.75)',
    })
    el.textContent = '◉ NV'
    document.body.appendChild(el)
    return el
  }
}
