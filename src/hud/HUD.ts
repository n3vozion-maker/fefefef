import type { WeaponBase }    from '../weapons/WeaponBase'
import type { PlayerStats }   from '../player/PlayerStats'
import { bus }                from '../core/EventBus'

export class HUD {
  private ammoEl:    HTMLElement
  private weaponEl:  HTMLElement
  private healthEl:  HTMLElement
  private healthBar: HTMLElement
  private staminaEl: HTMLElement
  private staminaBar: HTMLElement
  private crosshair: HTMLElement
  private hitmarker: HTMLElement
  private hitTimer   = 0

  constructor() {
    const root = document.createElement('div')
    Object.assign(root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      fontFamily: 'monospace', userSelect: 'none',
    })
    document.body.appendChild(root)

    // Crosshair
    this.crosshair = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      width: '4px', height: '4px',
      background: 'rgba(255,255,255,0.85)', borderRadius: '50%',
    })

    // Hitmarker (X shape drawn via two divs)
    this.hitmarker = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%) rotate(45deg)',
      width: '14px', height: '14px',
      opacity: '0', transition: 'opacity 0.08s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    })
    const hm1 = this.el(this.hitmarker, { position:'absolute', width:'14px', height:'2px', background:'#ff3333' })
    const hm2 = this.el(this.hitmarker, { position:'absolute', width:'2px', height:'14px', background:'#ff3333' })
    void hm1; void hm2

    // Ammo counter (bottom-right)
    const ammoGroup = this.el(root, {
      position: 'absolute', bottom: '42px', right: '40px', textAlign: 'right',
    })
    this.weaponEl = this.el(ammoGroup, {
      color: 'rgba(255,255,255,0.55)', fontSize: '11px', marginBottom: '2px',
      textTransform: 'uppercase', letterSpacing: '0.12em',
    })
    this.ammoEl = this.el(ammoGroup, {
      color: '#ffffff', fontSize: '26px', fontWeight: 'bold', letterSpacing: '0.04em',
    })

    // Health bar (bottom-left)
    const hpGroup = this.el(root, {
      position: 'absolute', bottom: '42px', left: '40px',
    })
    this.el(hpGroup, { color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }).textContent = 'Health'
    const hpTrack = this.el(hpGroup, { width: '140px', height: '4px', background: '#1a1a1a', borderRadius: '2px' })
    this.healthBar = this.el(hpTrack, { height: '100%', width: '100%', background: '#e53935', borderRadius: '2px', transition: 'width 0.2s' })
    this.healthEl  = this.el(hpGroup, { color: '#ffffff', fontSize: '13px', marginTop: '4px' })

    // Stamina bar (bottom-centre)
    const stGroup = this.el(root, {
      position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)',
    })
    const stTrack = this.el(stGroup, { width: '160px', height: '3px', background: '#1a1a1a', borderRadius: '2px' })
    this.staminaBar = this.el(stTrack, { height: '100%', width: '100%', background: '#4caf50', borderRadius: '2px', transition: 'width 0.1s' })
    this.staminaEl  = this.el(stGroup, { display: 'none' })   // reserved

    bus.on<{ agentId: string }>('damageEvent', () => this.flashHitmarker())
  }

  update(weapon: WeaponBase | null, stats: PlayerStats, stamina: number): void {
    // Weapon
    if (weapon) {
      this.weaponEl.textContent = weapon.getName()
      const reload = weapon.getIsReloading()
      this.ammoEl.textContent   = reload
        ? 'RELOADING'
        : `${weapon.getAmmo()} / ${weapon.getReserve()}`
      this.ammoEl.style.color   = reload ? '#ffa726' : weapon.getAmmo() === 0 ? '#e53935' : '#ffffff'
    } else {
      this.weaponEl.textContent = ''
      this.ammoEl.textContent   = ''
    }

    // Health
    const hpPct = (stats.health / stats.maxHealth) * 100
    this.healthBar.style.width      = `${hpPct}%`
    this.healthBar.style.background = hpPct > 50 ? '#4caf50' : hpPct > 25 ? '#ffa726' : '#e53935'
    this.healthEl.textContent       = `${Math.ceil(stats.health)}`

    // Stamina
    this.staminaBar.style.width      = `${stamina}%`
    this.staminaBar.style.background = stamina < 25 ? '#e53935' : '#4caf50'
  }

  private flashHitmarker(): void {
    this.hitmarker.style.opacity = '1'
    this.hitTimer = 0.12
  }

  tick(dt: number): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt
      if (this.hitTimer <= 0) this.hitmarker.style.opacity = '0'
    }
  }

  private el(parent: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLElement {
    const div = document.createElement('div')
    Object.assign(div.style, style)
    parent.appendChild(div)
    return div
  }
}
