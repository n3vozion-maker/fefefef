import { bus }                                  from '../core/EventBus'
import { DifficultySystem, DIFFICULTY_CONFIGS, type Difficulty } from '../core/DifficultySystem'

// ── TitleScreen ───────────────────────────────────────────────────────────────
// Shown at startup. Postal × Ultrakill aesthetic: black, red, aggressive type.
// Player picks difficulty then clicks ENGAGE → emits 'gameStarted'.

export class TitleScreen {
  private overlay:    HTMLElement
  private _dismissed  = false
  private difficulty: Difficulty = 'normal'

  constructor() {
    this.overlay = this.build()
  }

  isDismissed(): boolean { return this._dismissed }

  private dismiss(): void {
    if (this._dismissed) return
    this._dismissed = true
    DifficultySystem.set(this.difficulty)
    this.overlay.style.transition = 'opacity 0.45s'
    this.overlay.style.opacity    = '0'
    setTimeout(() => {
      this.overlay.style.display = 'none'
      bus.emit('gameStarted', {})
    }, 460)
  }

  private build(): HTMLElement {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes ts-flicker {
        0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:.85} 94%{opacity:1} 97%{opacity:.92} 98%{opacity:1}
      }
      @keyframes ts-scan {
        0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)}
      }
      @keyframes ts-pulse-red {
        0%,100%{text-shadow:0 0 30px #ff0000,0 0 60px #8b0000,0 3px 0 #4a0000}
        50%{text-shadow:0 0 55px #ff2200,0 0 110px #cc0000,0 3px 0 #4a0000}
      }
      @keyframes ts-subtitle {
        0%{opacity:0;letter-spacing:.5em} 100%{opacity:1;letter-spacing:.18em}
      }
      .ts-diff-btn {
        background:transparent; border:1px solid rgba(255,255,255,0.12);
        color:rgba(255,255,255,0.45); font-family:monospace; font-size:12px;
        font-weight:700; letter-spacing:.2em; padding:10px 0; cursor:pointer;
        transition:all .15s; outline:none; flex:1;
      }
      .ts-diff-btn:hover { color:#fff; border-color:rgba(255,255,255,0.4); }
      .ts-diff-btn.selected { color:#fff; border-width:1px; }
      .ts-play { background:#8b0000; color:#fff; border:1px solid #ff0000;
        padding:14px 56px; font-size:16px; font-family:monospace; font-weight:700;
        letter-spacing:.28em; cursor:pointer; outline:none; transition:all .12s; }
      .ts-play:hover { background:#cc0000; letter-spacing:.35em; }
    `
    document.head.appendChild(style)

    const el = document.createElement('div')
    Object.assign(el.style, {
      position:'fixed', inset:'0', background:'#000',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      zIndex:'999', fontFamily:'monospace', userSelect:'none',
      animation:'ts-flicker 8s infinite', overflow:'hidden',
    })
    document.body.appendChild(el)

    // Scanline
    const scan = document.createElement('div')
    Object.assign(scan.style, {
      position:'absolute', top:'0', left:'0', right:'0', height:'3px',
      background:'rgba(255,255,255,0.04)', animation:'ts-scan 4s linear infinite',
      pointerEvents:'none',
    })
    el.appendChild(scan)

    // Top rule
    el.appendChild(this.rule())

    // Pre-title
    const pre = document.createElement('div')
    pre.textContent = '// CLASSIFIED //'
    Object.assign(pre.style, { fontSize:'11px', color:'#ff000088', letterSpacing:'.4em', marginBottom:'14px' })
    el.appendChild(pre)

    // Title
    const title = document.createElement('div')
    title.textContent = 'IRON\u00a0ZERO'
    Object.assign(title.style, {
      fontSize:'clamp(72px,14vw,140px)', fontWeight:'900', color:'#ffffff',
      letterSpacing:'.08em', lineHeight:'1',
      animation:'ts-pulse-red 2.8s ease-in-out infinite', marginBottom:'10px',
    })
    el.appendChild(title)

    // Subtitle
    const sub = document.createElement('div')
    sub.textContent = 'NO MERCY. NO RETREAT. NO SIGNAL.'
    Object.assign(sub.style, {
      fontSize:'11px', color:'rgba(255,40,40,.75)', letterSpacing:'.18em',
      animation:'ts-subtitle 1.8s ease-out forwards', opacity:'0', marginBottom:'48px',
    })
    el.appendChild(sub)

    // Bottom rule
    el.appendChild(this.rule())

    // ── Difficulty selector ───────────────────────────────────────────────────
    const diffLabel = document.createElement('div')
    diffLabel.textContent = 'SELECT DIFFICULTY'
    Object.assign(diffLabel.style, {
      fontSize:'9px', color:'rgba(255,255,255,.3)', letterSpacing:'.25em',
      marginTop:'32px', marginBottom:'10px',
    })
    el.appendChild(diffLabel)

    const diffRow = document.createElement('div')
    Object.assign(diffRow.style, {
      display:'flex', gap:'2px', width:'460px',
    })
    el.appendChild(diffRow)

    const descEl = document.createElement('div')
    Object.assign(descEl.style, {
      fontSize:'10px', color:'rgba(255,255,255,.35)', letterSpacing:'.1em',
      marginTop:'8px', height:'16px', marginBottom:'28px',
    })
    el.appendChild(descEl)

    const diffBtns: Record<Difficulty, HTMLButtonElement> = {} as never
    const difficulties: Difficulty[] = ['easy', 'normal', 'hard']

    const updateDiff = (d: Difficulty): void => {
      this.difficulty = d
      const cfg = DIFFICULTY_CONFIGS[d]
      descEl.textContent      = cfg.description
      descEl.style.color      = cfg.color + 'aa'
      for (const [k, btn] of Object.entries(diffBtns) as [Difficulty, HTMLButtonElement][]) {
        const active = k === d
        const c      = DIFFICULTY_CONFIGS[k].color
        btn.classList.toggle('selected', active)
        btn.style.borderColor   = active ? c : 'rgba(255,255,255,0.12)'
        btn.style.color         = active ? c : 'rgba(255,255,255,0.45)'
        btn.style.background    = active ? c + '22' : 'transparent'
        btn.style.textShadow    = active ? `0 0 12px ${c}` : 'none'
      }
    }

    for (const d of difficulties) {
      const btn = document.createElement('button')
      btn.className   = 'ts-diff-btn'
      btn.textContent = DIFFICULTY_CONFIGS[d].label
      btn.addEventListener('click', () => updateDiff(d))
      diffBtns[d] = btn
      diffRow.appendChild(btn)
    }
    updateDiff('normal')   // default selection

    // ENGAGE button
    const engage = document.createElement('button')
    engage.className   = 'ts-play'
    engage.textContent = 'ENGAGE'
    engage.addEventListener('click', () => this.dismiss())
    el.appendChild(engage)

    // Hints
    const hint = document.createElement('div')
    hint.textContent = 'WASD · MOUSE · ESC pause'
    Object.assign(hint.style, {
      position:'absolute', bottom:'22px', fontSize:'9px',
      color:'rgba(255,255,255,.18)', letterSpacing:'.15em',
    })
    el.appendChild(hint)

    const ver = document.createElement('div')
    ver.textContent = 'v0.1.0'
    Object.assign(ver.style, {
      position:'absolute', bottom:'22px', right:'22px', fontSize:'9px',
      color:'rgba(255,0,0,.3)', letterSpacing:'.1em',
    })
    el.appendChild(ver)

    return el
  }

  private rule(): HTMLElement {
    const r = document.createElement('div')
    Object.assign(r.style, {
      width:'520px', height:'1px',
      background:'linear-gradient(90deg,transparent,#ff0000,transparent)',
      margin:'16px 0',
    })
    return r
  }
}
