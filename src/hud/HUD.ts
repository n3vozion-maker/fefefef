import type { WeaponBase }    from '../weapons/WeaponBase'
import type { PlayerStats }   from '../player/PlayerStats'
import type { TechAbilities } from '../player/TechAbilities'
import { bus }                from '../core/EventBus'

export class HUD {
  private ammoEl:    HTMLElement
  private weaponEl:  HTMLElement
  private healthEl:  HTMLElement
  private healthBar: HTMLElement
  private staminaBar: HTMLElement
  private crosshair: HTMLElement
  private hitmarker: HTMLElement
  private hitTimer   = 0

  // Tech indicators
  private dashPips:  HTMLElement[] = []
  private parryEl:   HTMLElement

  // Style: Postal × Ultrakill
  private vignetteEl:     HTMLElement
  private dmgFlashEl:     HTMLElement
  private killSplashEl:   HTMLElement
  private dmgFlashTimer   = 0
  private killSplashTimer = 0
  private hpCritPulse     = 0

  // HUD toast notifications
  private toastContainer: HTMLElement
  private toasts: Array<{ el: HTMLElement; timer: number }> = []

  // Interaction prompt ("Press E to …")
  private interactPromptEl: HTMLElement

  constructor() {
    const root = document.createElement('div')
    Object.assign(root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      fontFamily: 'monospace', userSelect: 'none',
    })
    document.body.appendChild(root)

    // ── Permanent vignette ────────────────────────────────────────────────────
    this.vignetteEl = this.el(root, {
      position:   'absolute', inset: '0',
      background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.72) 100%)',
      zIndex:     '0',
      transition: 'background 0.4s',
    })

    // ── Damage flash ──────────────────────────────────────────────────────────
    this.dmgFlashEl = this.el(root, {
      position:  'absolute', inset: '0',
      background:'rgba(180,0,0,0)',
      zIndex:    '1',
      transition:'background 0.06s',
    })

    // ── Kill splash (centre screen, Ultrakill-style) ───────────────────────────
    this.killSplashEl = this.el(root, {
      position:       'absolute', top: '38%', left: '50%',
      transform:      'translate(-50%,-50%)',
      fontSize:       '28px', fontWeight: '900',
      letterSpacing:  '0.3em', color: '#ff3030',
      textShadow:     '0 0 18px #ff0000, 0 2px 0 #8b0000',
      opacity:        '0',
      transition:     'opacity 0.06s',
      zIndex:         '10',
      userSelect:     'none',
    })
    this.killSplashEl.textContent = 'KILL'

    // ── Crosshair ─────────────────────────────────────────────────────────────

    this.crosshair = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      width: '4px', height: '4px',
      background: 'rgba(255,255,255,0.85)', borderRadius: '50%',
    })

    // ── Hitmarker ─────────────────────────────────────────────────────────────

    this.hitmarker = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%) rotate(45deg)',
      width: '14px', height: '14px',
      opacity: '0', transition: 'opacity 0.08s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    })
    this.el(this.hitmarker, { position: 'absolute', width: '14px', height: '2px', background: '#ff3333' })
    this.el(this.hitmarker, { position: 'absolute', width: '2px', height: '14px', background: '#ff3333' })

    // ── Ammo counter (bottom-right) ───────────────────────────────────────────

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

    // ── Health bar (bottom-left) ──────────────────────────────────────────────

    const hpGroup = this.el(root, {
      position: 'absolute', bottom: '42px', left: '40px',
    })
    this.el(hpGroup, {
      color: 'rgba(255,255,255,0.5)', fontSize: '10px',
      marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em',
    }).textContent = 'Health'
    const hpTrack = this.el(hpGroup, {
      width: '140px', height: '4px', background: '#1a1a1a', borderRadius: '2px',
    })
    this.healthBar = this.el(hpTrack, {
      height: '100%', width: '100%', background: '#e53935',
      borderRadius: '2px', transition: 'width 0.2s',
    })
    this.healthEl = this.el(hpGroup, {
      color: '#ffffff', fontSize: '13px', marginTop: '4px',
    })

    // ── Stamina bar (bottom-centre) ───────────────────────────────────────────

    const stGroup = this.el(root, {
      position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)',
    })
    const stTrack = this.el(stGroup, {
      width: '160px', height: '3px', background: '#1a1a1a', borderRadius: '2px',
    })
    this.staminaBar = this.el(stTrack, {
      height: '100%', width: '100%', background: '#4caf50',
      borderRadius: '2px', transition: 'width 0.1s',
    })

    // ── Tech abilities (left side, above health) ──────────────────────────────

    const techGroup = this.el(root, {
      position: 'absolute', bottom: '84px', left: '40px',
      display: 'flex', flexDirection: 'column', gap: '6px',
    })

    // Dash pips
    const dashRow = this.el(techGroup, {
      display: 'flex', gap: '5px', alignItems: 'center',
    })
    this.el(dashRow, {
      fontSize: '9px', color: 'rgba(255,255,255,0.35)',
      letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px',
    }).textContent = 'DASH'
    for (let i = 0; i < 2; i++) {
      const pip = this.el(dashRow, {
        width: '14px', height: '14px', borderRadius: '3px',
        background: '#00bcd4', border: '1px solid rgba(0,188,212,0.4)',
        transition: 'background 0.2s',
      })
      this.dashPips.push(pip)
    }

    // Parry indicator
    const parryRow = this.el(techGroup, {
      display: 'flex', gap: '5px', alignItems: 'center',
    })
    this.el(parryRow, {
      fontSize: '9px', color: 'rgba(255,255,255,0.35)',
      letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: '4px',
    }).textContent = 'PARRY'
    this.parryEl = this.el(parryRow, {
      width: '44px', height: '4px', borderRadius: '2px',
      background: '#e040fb', transition: 'background 0.15s, width 0.1s',
    })

    // ── Interaction prompt (bottom-centre, above stamina bar) ────────────────
    this.interactPromptEl = this.el(root, {
      position:      'absolute',
      bottom:        '68px',
      left:          '50%',
      transform:     'translateX(-50%)',
      fontFamily:    'monospace',
      fontSize:      '11px',
      letterSpacing: '0.1em',
      color:         'rgba(255,255,255,0.75)',
      background:    'rgba(0,0,0,0.55)',
      padding:       '4px 16px',
      border:        '1px solid rgba(255,255,255,0.18)',
      pointerEvents: 'none',
      display:       'none',
      whiteSpace:    'nowrap',
      userSelect:    'none',
    })

    // ── Toast notification area (below boss health bar) ───────────────────────
    this.toastContainer = this.el(root, {
      position:      'absolute',
      top:           '14%',
      left:          '50%',
      transform:     'translateX(-50%)',
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '6px',
      pointerEvents: 'none',
      zIndex:        '20',
    })

    // ── Events ────────────────────────────────────────────────────────────────

    bus.on('damageEvent', () => this.flashHitmarker())

    bus.on<string>('hudNotify', (msg) => this.showToast(msg))

    // Player hit → damage flash
    bus.on<{ damage: number }>('playerHit', ({ damage }) => {
      const intensity = Math.min(0.55, damage / 100)
      this.dmgFlashEl.style.background = `rgba(180,0,0,${intensity.toFixed(2)})`
      this.dmgFlashTimer = 0.22
    })

    // Enemy killed → KILL splash
    bus.on('agentDied', () => {
      this.killSplashEl.style.opacity  = '1'
      this.killSplashTimer = 0.45
    })

    // Parry flash
    bus.on('parryStarted', () => {
      this.parryEl.style.background = '#ffffff'
      setTimeout(() => { this.parryEl.style.background = '#e040fb' }, 150)
    })
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(weapon: WeaponBase | null, stats: PlayerStats, stamina: number, tech?: TechAbilities): void {
    // Weapon
    if (weapon) {
      this.weaponEl.textContent = weapon.getName()
      const reload = weapon.getIsReloading()
      this.ammoEl.textContent   = reload ? 'RELOADING' : `${weapon.getAmmo()} / ${weapon.getReserve()}`
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

    // Dash pips
    if (tech) {
      for (let i = 0; i < this.dashPips.length; i++) {
        const pip = this.dashPips[i]
        if (!pip) continue
        const filled = i < tech.charges
        pip.style.background = filled ? '#00bcd4' : 'rgba(0,188,212,0.12)'
        pip.style.borderColor = filled ? 'rgba(0,188,212,0.5)' : 'rgba(0,188,212,0.2)'
      }

      // Parry bar: full when ready, shrinks during cooldown
      this.parryEl.style.background = tech.parryCooling ? 'rgba(224,64,251,0.35)' : '#e040fb'
    }
  }

  tick(dt: number, hpPct = 100): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt
      if (this.hitTimer <= 0) this.hitmarker.style.opacity = '0'
    }

    // Damage flash fade
    if (this.dmgFlashTimer > 0) {
      this.dmgFlashTimer -= dt
      if (this.dmgFlashTimer <= 0) {
        this.dmgFlashEl.style.background = 'rgba(180,0,0,0)'
      }
    }

    // Kill splash fade
    if (this.killSplashTimer > 0) {
      this.killSplashTimer -= dt
      if (this.killSplashTimer <= 0) {
        this.killSplashEl.style.opacity = '0'
      }
    }

    // Toast timers
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i]!
      toast.timer -= dt
      if (toast.timer < 0.5) {
        toast.el.style.opacity = '0'
      }
      if (toast.timer <= 0) {
        toast.el.remove()
        this.toasts.splice(i, 1)
      }
    }

    // Critical HP: pulse red vignette (Ultrakill heartbeat)
    if (hpPct < 25) {
      this.hpCritPulse += dt * 3.5
      const pulse    = 0.5 + 0.5 * Math.sin(this.hpCritPulse)
      const alpha    = (0.28 + pulse * 0.22).toFixed(2)
      this.vignetteEl.style.background =
        `radial-gradient(ellipse at center, transparent 42%, rgba(140,0,0,${alpha}) 100%)`
    } else {
      this.hpCritPulse = 0
      this.vignetteEl.style.background =
        'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.72) 100%)'
    }
  }

  /** Show / hide the "Press E to …" prompt. Pass null to hide. */
  updateInteractPrompt(text: string | null): void {
    if (text) {
      this.interactPromptEl.textContent  = text
      this.interactPromptEl.style.display = 'block'
    } else {
      this.interactPromptEl.style.display = 'none'
    }
  }

  showToast(msg: string, duration = 3.2): void {
    const t = document.createElement('div')
    Object.assign(t.style, {
      background:    'rgba(0,0,0,0.72)',
      color:         '#ffcc00',
      fontFamily:    'monospace',
      fontSize:      '11px',
      fontWeight:    '700',
      letterSpacing: '0.14em',
      padding:       '6px 22px',
      borderLeft:    '2px solid #ffcc00',
      opacity:       '1',
      transition:    'opacity 0.5s',
      whiteSpace:    'nowrap',
      textTransform: 'uppercase',
      userSelect:    'none',
    })
    t.textContent = msg
    this.toastContainer.appendChild(t)
    this.toasts.push({ el: t, timer: duration })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private flashHitmarker(): void {
    this.hitmarker.style.opacity = '1'
    this.hitTimer = 0.12
  }

  private el(parent: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLElement {
    const div = document.createElement('div')
    Object.assign(div.style, style)
    parent.appendChild(div)
    return div
  }
}
