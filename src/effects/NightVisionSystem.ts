import * as THREE from 'three'
import { bus }    from '../core/EventBus'

export class NightVisionSystem {
  private active   = false
  private scanline: HTMLElement
  private vignette: HTMLElement
  private indicator: HTMLElement

  constructor(
    private canvas:   HTMLCanvasElement,
    private ambient:  THREE.AmbientLight,
    private hemi:     THREE.HemisphereLight,
  ) {
    this.scanline  = this.buildScanline()
    this.vignette  = this.buildVignette()
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
    // Green phosphor filter on the canvas
    this.canvas.style.filter =
      'sepia(1) saturate(4) hue-rotate(78deg) brightness(2.8) contrast(1.15)'

    // Boost ambient so the dark world is visible
    this.ambient.intensity += 0.85
    this.ambient.color.setHex(0x00ff44)
    this.hemi.intensity    += 0.40
    this.hemi.color.setHex(0x00ee33)

    this.scanline.style.display  = 'block'
    this.vignette.style.display  = 'block'
    this.indicator.style.display = 'block'
  }

  private disable(): void {
    this.canvas.style.filter = ''

    // Restore ambient (DayNightSystem will overwrite on next tick anyway)
    this.ambient.intensity -= 0.85
    this.ambient.color.setHex(0x4060a0)
    this.hemi.intensity    -= 0.40
    this.hemi.color.setHex(0x87ceeb)

    this.scanline.style.display  = 'none'
    this.vignette.style.display  = 'none'
    this.indicator.style.display = 'none'
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
        'radial-gradient(ellipse at center, transparent 55%, rgba(0,18,0,0.78) 100%)',
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
