import type { WeaponBase }    from '../weapons/WeaponBase'
import type { PlayerStats }   from '../player/PlayerStats'
import type { TechAbilities } from '../player/TechAbilities'
import { bus }                from '../core/EventBus'

const PIP_MAX = 40   // pips rendered in the grid; above this switches to numeric display

export class HUD {
  // Ammo
  private weaponEl:     HTMLElement
  private pipContainer: HTMLElement
  private pips:         HTMLElement[] = []
  private ammoNumEl:    HTMLElement
  private reserveEl:    HTMLElement
  private reloadTrack:  HTMLElement
  private reloadBar:    HTMLElement

  // Health / stamina
  private healthEl:  HTMLElement
  private healthBar: HTMLElement
  private staminaBar: HTMLElement

  // Crosshair lines (4-line tactical)
  private chT: HTMLElement
  private chB: HTMLElement
  private chL: HTMLElement
  private chR: HTMLElement

  // Hitmarker
  private hitmarker:  HTMLElement
  private hitTimer    = 0

  // Tech
  private dashPips: HTMLElement[] = []
  private parryEl:  HTMLElement

  // Feedback overlays
  private vignetteEl:     HTMLElement
  private dmgFlashEl:     HTMLElement
  private killSplashEl:   HTMLElement
  private dmgFlashTimer   = 0
  private killSplashTimer = 0
  private hpCritPulse     = 0

  // Toasts
  private toastContainer: HTMLElement
  private toasts: Array<{ el: HTMLElement; timer: number }> = []

  // Boss kill slow-mo overlay
  private bossKillOverlay: HTMLElement
  private bossKillTimer   = 0

  // Interact prompt
  private interactPromptEl: HTMLElement

  // Kill feed
  private killFeed:  HTMLElement
  private killLines: Array<{ el: HTMLElement; timer: number }> = []

  // Cash counter
  private cashEl: HTMLElement

  constructor() {
    // ── Shared CSS ──────────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      @keyframes hud-kill-in {
        0%   { transform:translate(-50%,-50%) scale(0.6); opacity:0; letter-spacing:.5em }
        18%  { transform:translate(-50%,-50%) scale(1.12); opacity:1 }
        100% { transform:translate(-50%,-50%) scale(1);   opacity:1; letter-spacing:.35em }
      }
      @keyframes hud-toast-in { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
      @keyframes hud-kf-in    { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
      .hud-pip        { width:5px; height:8px; border-radius:1px 1px 0 0; flex-shrink:0; }
      .hud-pip.full   { background:rgba(218,214,190,0.9); }
      .hud-pip.spent  { background:rgba(255,255,255,0.07); }
      .hud-pip.hide   { display:none; }
      .hud-seg-marker { position:absolute; top:0; width:1px; height:100%; background:rgba(0,0,0,0.45); pointer-events:none; }
    `
    document.head.appendChild(style)

    const root = document.createElement('div')
    Object.assign(root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none',
      fontFamily: 'monospace', userSelect: 'none', zIndex: '10',
    })
    document.body.appendChild(root)

    // ── Vignette ───────────────────────────────────────────────────────────────
    this.vignetteEl = this.el(root, {
      position: 'absolute', inset: '0',
      background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)',
    })

    // ── Damage flash ───────────────────────────────────────────────────────────
    this.dmgFlashEl = this.el(root, {
      position: 'absolute', inset: '0', background: 'rgba(180,0,0,0)',
    })

    // ── Kill splash ────────────────────────────────────────────────────────────
    this.killSplashEl = this.el(root, {
      position: 'absolute', top: '37%', left: '50%',
      transform: 'translate(-50%,-50%)',
      fontSize: '26px', fontWeight: '900', letterSpacing: '.35em',
      color: '#ff2020',
      textShadow: '0 0 18px #ff0000, 0 0 40px rgba(180,0,0,0.6), 0 2px 0 #3a0000',
      opacity: '0', zIndex: '10',
    })
    this.killSplashEl.textContent = '✕  KILL'

    // ── 4-line tactical crosshair ──────────────────────────────────────────────
    const chRoot = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      width: '0', height: '0',
    })
    const mkLine = (w: string, h: string, l: string, t: string): HTMLElement => {
      const d = document.createElement('div')
      Object.assign(d.style, {
        position: 'absolute', background: 'rgba(255,255,255,0.88)',
        boxShadow: '0 0 2px rgba(0,0,0,0.9)',
        width: w, height: h, left: l, top: t,
        transform: 'translate(-50%,-50%)',
      })
      chRoot.appendChild(d)
      return d
    }
    this.chT = mkLine('1.5px', '9px',  '0px', '-7px')
    this.chB = mkLine('1.5px', '9px',  '0px',  '7px')
    this.chL = mkLine('9px',  '1.5px', '-7px',  '0px')
    this.chR = mkLine('9px',  '1.5px',  '7px',  '0px')
    // Center dot
    this.el(chRoot, {
      position: 'absolute', width: '2px', height: '2px',
      background: 'rgba(255,255,255,0.65)', borderRadius: '50%',
      transform: 'translate(-50%,-50%)',
    })

    // ── Hitmarker ──────────────────────────────────────────────────────────────
    this.hitmarker = this.el(root, {
      position: 'absolute', top: '50%', left: '50%',
      width: '18px', height: '18px', opacity: '0',
      transform: 'translate(-50%,-50%) rotate(45deg)',
      transition: 'transform 0.06s ease-out',
    })
    this.el(this.hitmarker, {
      position: 'absolute', width: '18px', height: '2px', background: '#ffffff',
      top: '50%', transform: 'translateY(-50%)',
    })
    this.el(this.hitmarker, {
      position: 'absolute', width: '2px', height: '18px', background: '#ffffff',
      left: '50%', transform: 'translateX(-50%)',
    })

    // ── Ammo panel (bottom-right) ──────────────────────────────────────────────
    const ammoPanel = this.el(root, {
      position: 'absolute', bottom: '34px', right: '34px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px',
    })

    // Weapon name
    this.weaponEl = this.el(ammoPanel, {
      color: 'rgba(200,200,175,0.45)', fontSize: '9px',
      textTransform: 'uppercase', letterSpacing: '.22em',
    })

    // Pip grid — 5px wide bullets, rows of 10 right-aligned
    this.pipContainer = this.el(ammoPanel, {
      display: 'flex', flexWrap: 'wrap', gap: '2px',
      width: '62px',    // 10 pips × 5px + 9 × 2px gap = 68, but right-align
      justifyContent: 'flex-end',
    })
    for (let i = 0; i < PIP_MAX; i++) {
      const pip = document.createElement('div')
      pip.className = 'hud-pip hide'
      this.pipContainer.appendChild(pip)
      this.pips.push(pip)
    }

    // Numeric ammo text (large mags)
    this.ammoNumEl = this.el(ammoPanel, {
      fontSize: '30px', fontWeight: '700', letterSpacing: '.05em',
      color: '#dedad5', display: 'none',
      textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    })

    // Reserve
    this.reserveEl = this.el(ammoPanel, {
      color: 'rgba(200,200,175,0.4)', fontSize: '11px', letterSpacing: '.08em',
    })

    // Reload progress bar
    this.reloadTrack = this.el(ammoPanel, {
      width: '62px', height: '3px',
      background: 'rgba(255,255,255,0.08)', borderRadius: '2px', display: 'none',
    })
    this.reloadBar = this.el(this.reloadTrack, {
      height: '100%', width: '0%', background: '#ffa726', borderRadius: '2px',
    })

    // ── Health panel (bottom-left) ─────────────────────────────────────────────
    const hpPanel = this.el(root, {
      position: 'absolute', bottom: '34px', left: '34px',
    })

    // HP number row
    const hpNumRow = this.el(hpPanel, {
      display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '6px',
    })
    this.el(hpNumRow, {
      color: 'rgba(255,255,255,0.28)', fontSize: '9px', letterSpacing: '.18em',
      textTransform: 'uppercase',
    }).textContent = 'HP'
    this.healthEl = this.el(hpNumRow, {
      fontSize: '24px', fontWeight: '700', color: '#f0ece0',
      textShadow: '0 1px 4px rgba(0,0,0,0.8)', letterSpacing: '.04em',
    })

    // HP bar with segment dividers
    const hpWrap = this.el(hpPanel, { position: 'relative', width: '210px' })
    const hpTrack = this.el(hpWrap, {
      width: '210px', height: '9px', background: 'rgba(255,255,255,0.07)',
      borderRadius: '2px', overflow: 'hidden',
    })
    this.healthBar = this.el(hpTrack, {
      height: '100%', width: '100%', background: '#4caf50',
      borderRadius: '2px', transition: 'width 0.15s, background 0.3s',
    })
    for (const pct of [20, 40, 60, 80]) {
      const seg = document.createElement('div')
      seg.className = 'hud-seg-marker'
      seg.style.left = `${(pct / 100) * 210}px`
      hpWrap.appendChild(seg)
    }

    // ── Stamina bar (just above health panel) ─────────────────────────────────
    const stRow = this.el(root, {
      position: 'absolute', bottom: '60px', left: '34px',
      display: 'flex', alignItems: 'center', gap: '7px',
    })
    this.el(stRow, {
      color: 'rgba(255,255,255,0.22)', fontSize: '8px', letterSpacing: '.16em',
    }).textContent = 'STM'
    const stTrack = this.el(stRow, {
      width: '82px', height: '2px',
      background: 'rgba(255,255,255,0.07)', borderRadius: '1px',
    })
    this.staminaBar = this.el(stTrack, {
      height: '100%', width: '100%', background: '#4caf50',
      borderRadius: '1px', transition: 'width 0.1s',
    })

    // ── Tech abilities ─────────────────────────────────────────────────────────
    const techCol = this.el(root, {
      position: 'absolute', bottom: '80px', left: '34px',
      display: 'flex', flexDirection: 'column', gap: '5px',
    })
    const dashRow = this.el(techCol, { display: 'flex', gap: '4px', alignItems: 'center' })
    this.el(dashRow, {
      fontSize: '8px', color: 'rgba(255,255,255,0.25)', letterSpacing: '.16em', marginRight: '2px',
    }).textContent = 'DASH'
    for (let i = 0; i < 2; i++) {
      this.dashPips.push(this.el(dashRow, {
        width: '11px', height: '11px', borderRadius: '2px',
        background: '#00bcd4', border: '1px solid rgba(0,188,212,0.35)',
        transition: 'background 0.15s',
      }))
    }
    const parryRow = this.el(techCol, { display: 'flex', gap: '4px', alignItems: 'center' })
    this.el(parryRow, {
      fontSize: '8px', color: 'rgba(255,255,255,0.25)', letterSpacing: '.16em', marginRight: '2px',
    }).textContent = 'PRY'
    this.parryEl = this.el(parryRow, {
      width: '34px', height: '3px', borderRadius: '2px', background: '#e040fb',
    })

    // ── Boss kill slow-mo overlay ──────────────────────────────────────────────
    this.bossKillOverlay = this.el(root, {
      position: 'absolute', inset: '0',
      background: 'rgba(140,0,0,0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    })
    const bossKillLabel = document.createElement('div')
    Object.assign(bossKillLabel.style, {
      fontSize: '28px', fontWeight: '900', letterSpacing: '.4em',
      color: '#ff1a1a', textTransform: 'uppercase',
      textShadow: '0 0 30px rgba(255,0,0,0.8), 0 2px 0 #500',
      opacity: '0', transition: 'opacity 0.15s',
      fontFamily: 'monospace',
    })
    bossKillLabel.id    = '__bossKillLabel'
    bossKillLabel.textContent = 'BOSS ELIMINATED'
    this.bossKillOverlay.appendChild(bossKillLabel)

    // ── Interact prompt ────────────────────────────────────────────────────────
    this.interactPromptEl = this.el(root, {
      position: 'absolute', bottom: '72px', left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '11px', letterSpacing: '.1em',
      color: 'rgba(255,255,255,0.82)', background: 'rgba(0,0,0,0.62)',
      padding: '5px 18px', border: '1px solid rgba(255,255,255,0.18)',
      display: 'none', whiteSpace: 'nowrap',
    })

    // ── Toast notifications (center-top) ───────────────────────────────────────
    this.toastContainer = this.el(root, {
      position: 'absolute', top: '13%', left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
      zIndex: '20',
    })

    // ── Cash counter (top-left) ────────────────────────────────────────────────
    this.cashEl = this.el(root, {
      position: 'absolute', top: '14px', left: '14px',
      fontSize: '13px', fontWeight: '700', letterSpacing: '.06em',
      color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.45)',
      fontFamily: 'monospace',
    })
    this.cashEl.textContent = '$0'

    // ── Kill feed (top-right) ──────────────────────────────────────────────────
    this.killFeed = this.el(root, {
      position: 'absolute', top: '10px', right: '10px',
      display: 'flex', flexDirection: 'column', gap: '3px',
      alignItems: 'flex-end',
    })

    // ── Event listeners ────────────────────────────────────────────────────────
    bus.on('damageEvent', () => this.flashHitmarker('hit'))
    bus.on('agentDied',  () => this.flashHitmarker('kill'))
    bus.on<string | { msg: string; color?: string }>('hudNotify', (payload) => {
      if (typeof payload === 'string') this.showToast(payload)
      else this.showToast(payload.msg, 3.5, payload.color)
    })
    bus.on<{ damage: number }>('playerHit', ({ damage }) => {
      const a = Math.min(0.62, damage / 85)
      this.dmgFlashEl.style.background = `rgba(180,0,0,${a.toFixed(2)})`
      this.dmgFlashTimer = 0.28
    })
    bus.on('agentDied', () => {
      this.killSplashEl.style.opacity   = '1'
      this.killSplashEl.style.animation = 'none'
      void this.killSplashEl.offsetWidth  // reflow
      this.killSplashEl.style.animation = 'hud-kill-in 0.22s ease-out forwards'
      this.killSplashTimer = 0.55
      this.addKillLine()
    })
    bus.on('parryStarted', () => {
      this.parryEl.style.background = '#ffffff'
      setTimeout(() => { this.parryEl.style.background = '#e040fb' }, 160)
    })
    bus.on<number>('cashChanged', (amount) => {
      this.cashEl.textContent = `$${amount.toLocaleString()}`
    })
  }

  // ── Update (called every frame) ───────────────────────────────────────────────

  update(weapon: WeaponBase | null, stats: PlayerStats, stamina: number, tech?: TechAbilities): void {
    // ── Ammo ──────────────────────────────────────────────────────────────────
    if (weapon) {
      this.weaponEl.textContent = weapon.getName()
      const ammo      = weapon.getAmmo()
      const mag       = weapon.getMagSize()
      const reserve   = weapon.getReserve()
      const reloading = weapon.getIsReloading()
      const reloadPct = weapon.getReloadProgress() * 100
      const lowAmmo   = !reloading && ammo > 0 && ammo <= Math.ceil(mag * 0.25)

      // Reload bar progress
      if (reloading) {
        this.reloadTrack.style.display = 'block'
        this.reloadBar.style.width = `${reloadPct.toFixed(1)}%`
      } else {
        this.reloadTrack.style.display = 'none'
        this.reloadBar.style.width = '0%'
      }

      if (mag <= PIP_MAX) {
        // Pip mode
        this.pipContainer.style.display = 'flex'
        this.ammoNumEl.style.display    = 'none'
        for (let i = 0; i < PIP_MAX; i++) {
          const pip = this.pips[i]!
          if (i >= mag) {
            pip.className = 'hud-pip hide'
          } else {
            pip.className = 'hud-pip ' + (i < ammo ? 'full' : 'spent')
            if (lowAmmo && i < ammo) pip.style.background = '#ef5350'
            else if (i < ammo)       pip.style.background = ''
          }
        }
      } else {
        this.pipContainer.style.display = 'none'
        this.ammoNumEl.style.display    = 'block'
        this.ammoNumEl.textContent      = reloading ? 'RELOADING...' : `${ammo}`
        this.ammoNumEl.style.color      = reloading ? '#ffa726' : lowAmmo ? '#ef5350' : '#dedad5'
      }

      this.reserveEl.textContent = reloading
        ? `${reserve} in reserve`
        : reserve === 0 ? '! NO AMMO' : `+${reserve}`
      this.reserveEl.style.color = reserve === 0 && !reloading
        ? 'rgba(239,83,80,0.65)'
        : 'rgba(200,200,175,0.4)'

    } else {
      this.weaponEl.textContent           = ''
      this.reserveEl.textContent          = ''
      this.pipContainer.style.display     = 'none'
      this.ammoNumEl.style.display        = 'none'
      this.reloadTrack.style.display      = 'none'
    }

    // ── Health ─────────────────────────────────────────────────────────────────
    const hpPct = (stats.health / stats.maxHealth) * 100
    this.healthBar.style.width      = `${hpPct.toFixed(1)}%`
    this.healthBar.style.background = hpPct > 60 ? '#4caf50' : hpPct > 30 ? '#ffa726' : '#ef5350'
    this.healthEl.textContent       = `${Math.ceil(stats.health)}`

    // ── Stamina ────────────────────────────────────────────────────────────────
    this.staminaBar.style.width      = `${stamina.toFixed(1)}%`
    this.staminaBar.style.background = stamina < 25 ? '#ef5350' : '#4caf50'

    // ── Tech ───────────────────────────────────────────────────────────────────
    if (tech) {
      for (let i = 0; i < this.dashPips.length; i++) {
        const filled = i < tech.charges
        this.dashPips[i]!.style.background  = filled ? '#00bcd4' : 'rgba(0,188,212,0.09)'
        this.dashPips[i]!.style.borderColor = filled ? 'rgba(0,188,212,0.42)' : 'rgba(0,188,212,0.14)'
      }
      this.parryEl.style.background = tech.parryCooling ? 'rgba(224,64,251,0.28)' : '#e040fb'
    }
  }

  tick(dt: number, hpPct = 100): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt
      if (this.hitTimer <= 0) {
        this.hitmarker.style.opacity   = '0'
        this.hitmarker.style.transform = 'translate(-50%,-50%) rotate(45deg) scale(1)'
        Array.from(this.hitmarker.children).forEach(c => {
          (c as HTMLElement).style.background = '#ffffff'
        })
      }
    }
    if (this.dmgFlashTimer > 0) {
      this.dmgFlashTimer -= dt
      if (this.dmgFlashTimer <= 0) this.dmgFlashEl.style.background = 'rgba(180,0,0,0)'
    }
    if (this.killSplashTimer > 0) {
      this.killSplashTimer -= dt
      if (this.killSplashTimer <= 0) this.killSplashEl.style.opacity = '0'
    }

    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!
      t.timer -= dt
      if (t.timer < 0.55) t.el.style.opacity = '0'
      if (t.timer <= 0)  { t.el.remove(); this.toasts.splice(i, 1) }
    }

    for (let i = this.killLines.length - 1; i >= 0; i--) {
      const k = this.killLines[i]!
      k.timer -= dt
      if (k.timer < 0.6) k.el.style.opacity = '0'
      if (k.timer <= 0)  { k.el.remove(); this.killLines.splice(i, 1) }
    }

    // Boss kill slow-mo overlay
    if (this.bossKillTimer > 0) {
      this.bossKillTimer -= dt
      const frac = Math.max(0, this.bossKillTimer / 2.0)
      const redA = (frac * 0.28).toFixed(2)
      this.bossKillOverlay.style.background = `rgba(140,0,0,${redA})`
      const label = document.getElementById('__bossKillLabel')
      if (label) label.style.opacity = frac > 0.5 ? '1' : (frac * 2).toFixed(2)
      if (this.bossKillTimer <= 0) {
        this.bossKillOverlay.style.background = 'rgba(140,0,0,0)'
        if (label) label.style.opacity = '0'
      }
    }

    // Critical HP — red heartbeat vignette
    if (hpPct < 25) {
      this.hpCritPulse += dt * 3.8
      const p = 0.5 + 0.5 * Math.sin(this.hpCritPulse)
      const a = (0.3 + p * 0.28).toFixed(2)
      this.vignetteEl.style.background =
        `radial-gradient(ellipse at center, transparent 38%, rgba(130,0,0,${a}) 100%)`
    } else {
      this.hpCritPulse = 0
      this.vignetteEl.style.background =
        'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)'
    }
  }

  flashBossKill(): void {
    this.bossKillTimer = 2.0
    const label = document.getElementById('__bossKillLabel')
    if (label) label.style.opacity = '1'
  }

  updateInteractPrompt(text: string | null): void {
    if (text) {
      this.interactPromptEl.textContent  = text
      this.interactPromptEl.style.display = 'block'
    } else {
      this.interactPromptEl.style.display = 'none'
    }
  }

  showToast(msg: string, duration = 3.5, color = '#ffe55a'): void {
    const t = document.createElement('div')
    Object.assign(t.style, {
      background:    'rgba(0,0,0,0.78)',
      color,
      fontSize:      '11px', fontWeight: '700',
      letterSpacing: '.16em', padding: '6px 22px',
      borderLeft:    '2px solid #ffe55a',
      opacity:       '1', transition: 'opacity 0.55s',
      whiteSpace:    'nowrap', textTransform: 'uppercase',
      animation:     'hud-toast-in 0.18s ease-out',
    })
    t.textContent = msg
    this.toastContainer.appendChild(t)
    this.toasts.push({ el: t, timer: duration })
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private addKillLine(): void {
    if (this.killLines.length >= 5) {
      this.killLines[0]?.el.remove()
      this.killLines.shift()
    }
    const el = document.createElement('div')
    Object.assign(el.style, {
      color:         'rgba(255,80,80,0.88)',
      fontSize:      '9px', fontFamily: 'monospace',
      letterSpacing: '.14em', padding: '2px 8px',
      background:    'rgba(0,0,0,0.42)',
      borderLeft:    '1px solid rgba(255,60,60,0.45)',
      opacity:       '1', transition: 'opacity 0.6s',
      animation:     'hud-kf-in 0.18s ease-out',
      whiteSpace:    'nowrap',
    })
    el.textContent = '✕  ENEMY DOWN'
    this.killFeed.appendChild(el)
    this.killLines.push({ el, timer: 4.0 })
  }

  private flashHitmarker(type: 'hit' | 'kill' = 'hit'): void {
    const color = type === 'kill' ? '#ff3300' : '#ffffff'
    const scale = type === 'kill' ? 'translate(-50%,-50%) rotate(45deg) scale(1.5)' : 'translate(-50%,-50%) rotate(45deg) scale(1)'
    // Recolor both arms
    Array.from(this.hitmarker.children).forEach(c => {
      (c as HTMLElement).style.background = color
    })
    this.hitmarker.style.transform = scale
    this.hitmarker.style.opacity   = '1'
    this.hitTimer = type === 'kill' ? 0.22 : 0.14
  }

  private el(parent: HTMLElement, style: Partial<CSSStyleDeclaration>): HTMLElement {
    const div = document.createElement('div')
    Object.assign(div.style, style)
    parent.appendChild(div)
    return div
  }
}
