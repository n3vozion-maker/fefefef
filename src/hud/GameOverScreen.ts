import { bus } from '../core/EventBus'

export class GameOverScreen {
  private overlay: HTMLElement
  private visible  = false
  private onRespawn: () => void

  constructor(onRespawn: () => void) {
    this.onRespawn = onRespawn

    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', pointerEvents: 'none',
      transition: 'background 0.8s',
      zIndex: '100',
    })

    const title = document.createElement('div')
    Object.assign(title.style, {
      color: '#cc1111', fontSize: '64px', fontWeight: 'bold',
      letterSpacing: '0.18em', textTransform: 'uppercase',
      textShadow: '0 0 40px #ff000088',
      transform: 'translateY(-20px)', opacity: '0',
      transition: 'opacity 0.6s 0.4s, transform 0.6s 0.4s',
    })
    title.textContent = 'YOU DIED'

    const sub = document.createElement('div')
    Object.assign(sub.style, {
      color: 'rgba(255,255,255,0.7)', fontSize: '15px',
      marginTop: '24px', letterSpacing: '0.12em',
      opacity: '0', transition: 'opacity 0.6s 0.9s',
    })
    sub.textContent = 'Press  R  to respawn at last checkpoint'

    this.overlay.appendChild(title)
    this.overlay.appendChild(sub)
    document.body.appendChild(this.overlay)

    // R key to respawn
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.visible) this.hide()
    })

    bus.on('showGameOver', () => this.show())
  }

  private show(): void {
    this.visible = true
    this.overlay.style.pointerEvents = 'all'
    this.overlay.style.background    = 'rgba(10,0,0,0.82)'
    const title = this.overlay.children[0] as HTMLElement
    const sub   = this.overlay.children[1] as HTMLElement
    setTimeout(() => {
      title.style.opacity   = '1'
      title.style.transform = 'translateY(0)'
      sub.style.opacity     = '1'
    }, 50)
  }

  private hide(): void {
    this.visible = false
    this.overlay.style.pointerEvents = 'none'
    this.overlay.style.background    = 'rgba(0,0,0,0)'
    const title = this.overlay.children[0] as HTMLElement
    const sub   = this.overlay.children[1] as HTMLElement
    title.style.opacity   = '0'
    title.style.transform = 'translateY(-20px)'
    sub.style.opacity     = '0'
    this.onRespawn()
  }

  isVisible(): boolean { return this.visible }
}
