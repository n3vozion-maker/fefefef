import type { WeaponManager } from '../weapons/WeaponManager'
import type { WeaponBase }    from '../weapons/WeaponBase'
import { bus }                from '../core/EventBus'

// ── Colours per category ──────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  rifle:     '#4fc3f7',
  smg:       '#81d4fa',
  sniper:    '#ce93d8',
  shotgun:   '#ffcc80',
  pistol:    '#a5d6a7',
  explosive: '#ef9a9a',
  flag:      '#ffd700',
}
const fallbackColor = '#90a4ae'

function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? fallbackColor
}

// ── WeaponLoadoutMenu ─────────────────────────────────────────────────────────
// Opens with Tab.  Shows 3 equipped slots at the top + scrollable backpack below.
// Click an equipped slot → select it (gold highlight).
// Click a backpack card → swap into selected slot.
// Right-click an equipped slot → holster it.

export class WeaponLoadoutMenu {
  private overlay:  HTMLElement
  private slotEls:  HTMLElement[] = []
  private bpList:   HTMLElement
  private _open     = false
  private selected: 0 | 1 | 2 | null = null

  constructor(private mgr: WeaponManager) {
    // ── Overlay ──────────────────────────────────────────────────────────────
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(5px)',
      fontFamily: 'monospace', color: '#fff', zIndex: '85',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      paddingTop: '6vh', gap: '0',
    })

    // ── Title ────────────────────────────────────────────────────────────────
    const title = document.createElement('div')
    Object.assign(title.style, {
      fontSize: '13px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase', marginBottom: '28px',
    })
    title.textContent = 'WEAPON LOADOUT  —  Tab to close  |  Click slot → select  |  Click backpack → swap  |  Right-click slot → holster'
    this.overlay.appendChild(title)

    // ── Equipped slots row ────────────────────────────────────────────────────
    const slotRow = document.createElement('div')
    Object.assign(slotRow.style, {
      display: 'flex', gap: '16px', marginBottom: '32px',
    })

    for (let i = 0; i < 3; i++) {
      const el = this.makeSlotCard(i as 0 | 1 | 2)
      slotRow.appendChild(el)
      this.slotEls.push(el)
    }
    this.overlay.appendChild(slotRow)

    // ── Backpack section ──────────────────────────────────────────────────────
    const bpHeader = document.createElement('div')
    Object.assign(bpHeader.style, {
      fontSize: '11px', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase', marginBottom: '14px', alignSelf: 'flex-start',
      marginLeft: 'calc(50vw - 312px)',
    })
    bpHeader.textContent = 'Backpack'
    this.overlay.appendChild(bpHeader)

    const bpScroll = document.createElement('div')
    Object.assign(bpScroll.style, {
      overflowY: 'auto', maxHeight: '45vh', width: '660px',
    })
    this.bpList = document.createElement('div')
    Object.assign(this.bpList.style, {
      display: 'flex', flexWrap: 'wrap', gap: '12px',
    })
    bpScroll.appendChild(this.bpList)
    this.overlay.appendChild(bpScroll)

    document.body.appendChild(this.overlay)

    // ── Keyboard toggle ───────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        this._open ? this.hide() : this.show()
      }
    })

    // Refresh when loadout changes (unlock, ammo pickup, etc.)
    bus.on('loadoutChanged', () => { if (this._open) this.rebuild() })
  }

  // ── Public ───────────────────────────────────────────────────────────────────

  isOpen(): boolean { return this._open }

  // ── Show / Hide ───────────────────────────────────────────────────────────────

  private show(): void {
    this._open = true
    this.overlay.style.display = 'flex'
    this.rebuild()
  }

  private hide(): void {
    this._open    = false
    this.selected = null
    this.overlay.style.display = 'none'
  }

  // ── Build ─────────────────────────────────────────────────────────────────────

  private rebuild(): void {
    // Re-render all 3 slot cards
    for (let i = 0; i < 3; i++) {
      this.refreshSlotCard(i as 0 | 1 | 2)
    }

    // Re-render backpack
    this.bpList.innerHTML = ''
    const bp = this.mgr.backpack
    if (bp.length === 0) {
      const empty = document.createElement('div')
      Object.assign(empty.style, { color: 'rgba(255,255,255,0.25)', fontSize: '12px', padding: '12px' })
      empty.textContent = 'Backpack is empty'
      this.bpList.appendChild(empty)
    } else {
      bp.forEach((w, idx) => {
        const card = this.makeBackpackCard(w, idx)
        this.bpList.appendChild(card)
      })
    }
  }

  // ── Slot card ─────────────────────────────────────────────────────────────────

  private makeSlotCard(slot: 0 | 1 | 2): HTMLElement {
    const card = document.createElement('div')
    Object.assign(card.style, {
      width: '200px', minHeight: '130px',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '4px', padding: '14px 16px',
      background: 'rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column', gap: '6px',
      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      position: 'relative',
    })

    card.addEventListener('click', () => this.onSlotClick(slot, card))
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.mgr.holsterSlot(slot)
      this.selected = null
      this.rebuild()
    })
    card.addEventListener('mouseenter', () => {
      if (this.selected !== slot) card.style.background = 'rgba(255,255,255,0.07)'
    })
    card.addEventListener('mouseleave', () => {
      if (this.selected !== slot) card.style.background = 'rgba(255,255,255,0.04)'
    })

    this.fillSlotCard(card, slot)
    return card
  }

  private refreshSlotCard(slot: 0 | 1 | 2): void {
    const card = this.slotEls[slot]
    if (!card) return
    card.innerHTML = ''
    this.fillSlotCard(card, slot)

    const isSelected = this.selected === slot
    card.style.borderColor = isSelected ? '#ffc107' : 'rgba(255,255,255,0.12)'
    card.style.background  = isSelected ? 'rgba(255,193,7,0.08)' : 'rgba(255,255,255,0.04)'
  }

  private fillSlotCard(card: HTMLElement, slot: 0 | 1 | 2): void {
    const labels = ['1  RIFLE / PRIMARY', '2  SECONDARY', '3  SIDEARM']

    // Slot label
    const label = document.createElement('div')
    Object.assign(label.style, {
      fontSize: '9px', letterSpacing: '0.14em',
      color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
      marginBottom: '2px',
    })
    label.textContent = labels[slot] ?? `SLOT ${slot + 1}`
    card.appendChild(label)

    const w = this.mgr.slots[slot]
    if (!w) {
      const empty = document.createElement('div')
      Object.assign(empty.style, {
        color: 'rgba(255,255,255,0.2)', fontSize: '13px', marginTop: '12px',
      })
      empty.textContent = '[ EMPTY ]'
      card.appendChild(empty)
    } else {
      this.appendWeaponInfo(card, w)
    }

    // Active indicator
    if (slot === this.mgr.getCurrentSlot() && w) {
      const dot = document.createElement('div')
      Object.assign(dot.style, {
        position: 'absolute', top: '10px', right: '12px',
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#4caf50',
      })
      card.appendChild(dot)
    }
  }

  // ── Backpack card ─────────────────────────────────────────────────────────────

  private makeBackpackCard(w: WeaponBase, idx: number): HTMLElement {
    const card = document.createElement('div')
    const cc   = catColor(w.getCategory())

    Object.assign(card.style, {
      width: '196px', minHeight: '110px',
      border: `1px solid ${cc}44`,
      borderRadius: '4px', padding: '12px 14px',
      background: 'rgba(255,255,255,0.03)',
      display: 'flex', flexDirection: 'column', gap: '5px',
      cursor: this.selected !== null ? 'pointer' : 'default',
      transition: 'border-color 0.15s, background 0.15s',
    })

    card.addEventListener('mouseenter', () => {
      if (this.selected !== null) {
        card.style.borderColor = cc
        card.style.background  = `${cc}14`
      }
    })
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = `${cc}44`
      card.style.background  = 'rgba(255,255,255,0.03)'
    })

    card.addEventListener('click', () => {
      if (this.selected === null) return
      this.mgr.swapBackpackIntoSlot(idx, this.selected)
      this.selected = null
      this.rebuild()
    })

    this.appendWeaponInfo(card, w)
    return card
  }

  // ── Shared weapon info block ──────────────────────────────────────────────────

  private appendWeaponInfo(parent: HTMLElement, w: WeaponBase): void {
    const cc = catColor(w.getCategory())

    // Category badge
    const badge = document.createElement('div')
    Object.assign(badge.style, {
      fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase',
      color: cc, marginBottom: '1px',
    })
    badge.textContent = w.getCategory()
    parent.appendChild(badge)

    // Name
    const name = document.createElement('div')
    Object.assign(name.style, {
      fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.04em',
      color: '#fff', lineHeight: '1.2',
    })
    name.textContent = w.getName()
    parent.appendChild(name)

    // Stats row
    const statsRow = document.createElement('div')
    Object.assign(statsRow.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px',
      marginTop: '6px',
    })

    const stats: [string, string][] = [
      ['DMG',  String(w.getDamage())],
      ['RoF',  String(w.getRoF())],
      ['MAG',  String(w.getMagSize())],
      ['AMMO', `${w.getAmmo()} + ${w.getReserve()}`],
    ]
    for (const [k, v] of stats) {
      const kEl = document.createElement('span')
      Object.assign(kEl.style, { fontSize: '10px', color: 'rgba(255,255,255,0.38)' })
      kEl.textContent = k

      const vEl = document.createElement('span')
      Object.assign(vEl.style, { fontSize: '10px', color: 'rgba(255,255,255,0.75)' })
      vEl.textContent = v

      statsRow.appendChild(kEl)
      statsRow.appendChild(vEl)
    }
    parent.appendChild(statsRow)
  }

  // ── Slot click logic ──────────────────────────────────────────────────────────

  private onSlotClick(slot: 0 | 1 | 2, _card: HTMLElement): void {
    if (this.selected === null) {
      // Select this slot
      this.selected = slot
    } else if (this.selected === slot) {
      // Deselect
      this.selected = null
    } else {
      // Swap two equipped slots
      this.mgr.swapSlots(this.selected, slot)
      this.selected = null
    }
    this.rebuild()
  }
}
