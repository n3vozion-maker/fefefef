import type { WeaponManager }   from '../weapons/WeaponManager'
import type { WeaponBase }      from '../weapons/WeaponBase'
import type { CashSystem }      from '../economy/CashSystem'
import type { GrenadeSystem }   from '../combat/GrenadeSystem'
import { AttachmentRegistry }   from '../weapons/AttachmentRegistry'
import type { AttachmentDef }   from '../weapons/AttachmentRegistry'
import type { AttachmentSlot }  from '../weapons/WeaponRegistry'
import { bus }                  from '../core/EventBus'

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

const SLOT_ORDER: AttachmentSlot[] = ['scope', 'muzzle', 'grip', 'magazine', 'underbarrel']
const SLOT_LABEL: Record<AttachmentSlot, string> = {
  scope:       'SCOPE',
  muzzle:      'MUZZLE',
  grip:        'GRIP',
  magazine:    'MAGAZINE',
  underbarrel: 'UNDERBARREL',
}

// ── WeaponLoadoutMenu ─────────────────────────────────────────────────────────

export class WeaponLoadoutMenu {
  private overlay:  HTMLElement
  private slotEls:  HTMLElement[] = []
  private bpList:   HTMLElement
  private attPanel: HTMLElement   // attachment shop panel
  private _open     = false
  private selected: 0 | 1 | 2 | null = null

  constructor(private mgr: WeaponManager, private cash: CashSystem, private grenades: GrenadeSystem) {
    // ── Shared CSS ────────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      .att-buy-btn {
        padding:3px 10px; border-radius:2px; cursor:pointer; font-size:9px;
        font-family:monospace; letter-spacing:.12em; border:1px solid rgba(255,215,0,0.45);
        background:rgba(255,215,0,0.08); color:#ffd700; transition:background 0.12s;
        white-space:nowrap;
      }
      .att-buy-btn:hover { background:rgba(255,215,0,0.18); }
      .att-buy-btn.equipped {
        border-color:rgba(100,220,100,0.5); background:rgba(100,220,100,0.1); color:#6fef8f;
        cursor:default;
      }
      .att-buy-btn.unequip {
        border-color:rgba(255,80,80,0.4); background:rgba(255,80,80,0.08); color:#ff6060;
      }
      .att-buy-btn.unequip:hover { background:rgba(255,80,80,0.18); }
      .att-buy-btn.cant-afford { opacity:0.35; cursor:not-allowed; }
      .att-slot-header {
        font-size:8px; letter-spacing:.2em; color:rgba(255,255,255,0.28);
        text-transform:uppercase; padding:7px 0 4px; border-top:1px solid rgba(255,255,255,0.06);
        margin-top:6px;
      }
      .att-slot-header:first-child { border-top:none; margin-top:0; padding-top:0; }
      .att-row {
        display:flex; align-items:center; justify-content:space-between;
        gap:10px; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04);
      }
      .att-row:last-child { border-bottom:none; }
    `
    document.head.appendChild(style)

    // ── Overlay ──────────────────────────────────────────────────────────────
    this.overlay = document.createElement('div')
    Object.assign(this.overlay.style, {
      position: 'fixed', inset: '0', display: 'none',
      background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(5px)',
      fontFamily: 'monospace', color: '#fff', zIndex: '85',
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '5vh', gap: '28px', paddingLeft: '20px', paddingRight: '20px',
    })

    // ── Left column: loadout ──────────────────────────────────────────────────
    const leftCol = document.createElement('div')
    Object.assign(leftCol.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: '0', flexShrink: '0',
    })

    // Title
    const title = document.createElement('div')
    Object.assign(title.style, {
      fontSize: '11px', letterSpacing: '.22em', color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase', marginBottom: '22px',
    })
    title.textContent = 'WEAPON LOADOUT  —  Tab to close  ·  Click slot → select  ·  Click backpack → swap  ·  Right-click slot → holster'
    leftCol.appendChild(title)

    // Slot row
    const slotRow = document.createElement('div')
    Object.assign(slotRow.style, { display: 'flex', gap: '14px', marginBottom: '28px' })
    for (let i = 0; i < 3; i++) {
      const el = this.makeSlotCard(i as 0 | 1 | 2)
      slotRow.appendChild(el)
      this.slotEls.push(el)
    }
    leftCol.appendChild(slotRow)

    // Backpack header
    const bpHeader = document.createElement('div')
    Object.assign(bpHeader.style, {
      fontSize: '10px', letterSpacing: '.16em', color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', marginBottom: '12px',
    })
    bpHeader.textContent = 'Backpack'
    leftCol.appendChild(bpHeader)

    const bpScroll = document.createElement('div')
    Object.assign(bpScroll.style, { overflowY: 'auto', maxHeight: '42vh', width: '642px' })
    this.bpList = document.createElement('div')
    Object.assign(this.bpList.style, { display: 'flex', flexWrap: 'wrap', gap: '12px' })
    bpScroll.appendChild(this.bpList)
    leftCol.appendChild(bpScroll)

    this.overlay.appendChild(leftCol)

    // ── Right column: attachment shop ─────────────────────────────────────────
    const rightCol = document.createElement('div')
    Object.assign(rightCol.style, {
      width: '330px', flexShrink: '0', display: 'flex', flexDirection: 'column',
    })

    const attHeader = document.createElement('div')
    Object.assign(attHeader.style, {
      fontSize: '10px', letterSpacing: '.2em', color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', marginBottom: '14px',
    })
    attHeader.textContent = 'Attachments'
    rightCol.appendChild(attHeader)

    const attScroll = document.createElement('div')
    Object.assign(attScroll.style, { overflowY: 'auto', maxHeight: '88vh' })
    this.attPanel = document.createElement('div')
    Object.assign(this.attPanel.style, { display: 'flex', flexDirection: 'column' })
    attScroll.appendChild(this.attPanel)
    rightCol.appendChild(attScroll)

    this.overlay.appendChild(rightCol)
    document.body.appendChild(this.overlay)

    // ── Keyboard toggle ───────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        this._open ? this.hide() : this.show()
      }
    })

    bus.on('loadoutChanged', () => { if (this._open) this.rebuild() })
    bus.on<number>('cashChanged', () => { if (this._open) this.rebuildAttachPanel() })
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
    for (let i = 0; i < 3; i++) this.refreshSlotCard(i as 0 | 1 | 2)

    this.bpList.innerHTML = ''
    const bp = this.mgr.backpack
    if (bp.length === 0) {
      const empty = document.createElement('div')
      Object.assign(empty.style, { color: 'rgba(255,255,255,0.22)', fontSize: '12px', padding: '12px' })
      empty.textContent = 'Backpack is empty'
      this.bpList.appendChild(empty)
    } else {
      bp.forEach((w, idx) => this.bpList.appendChild(this.makeBackpackCard(w, idx)))
    }

    this.rebuildAttachPanel()
  }

  // ── Attachment panel ──────────────────────────────────────────────────────────

  private rebuildAttachPanel(): void {
    this.attPanel.innerHTML = ''

    // Use the active weapon as the target for attachments
    const w = this.mgr.activeWeapon()
    if (!w) {
      const none = document.createElement('div')
      Object.assign(none.style, { color: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '8px' })
      none.textContent = 'No weapon equipped'
      this.attPanel.appendChild(none)
      return
    }

    // Weapon name + cash balance
    const weaponRow = document.createElement('div')
    Object.assign(weaponRow.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: '14px',
    })
    const wName = document.createElement('div')
    Object.assign(wName.style, { fontSize: '13px', fontWeight: 'bold', color: '#fff', letterSpacing: '.05em' })
    wName.textContent = w.getName()
    const cashBadge = document.createElement('div')
    Object.assign(cashBadge.style, { fontSize: '13px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '.04em' })
    cashBadge.textContent = `$${this.cash.cash.toLocaleString()}`
    weaponRow.appendChild(wName)
    weaponRow.appendChild(cashBadge)
    this.attPanel.appendChild(weaponRow)

    const supportedSlots = w.getStats().attachmentSlots
    if (!supportedSlots || supportedSlots.length === 0) {
      const noSlot = document.createElement('div')
      Object.assign(noSlot.style, { color: 'rgba(255,255,255,0.2)', fontSize: '11px' })
      noSlot.textContent = 'This weapon has no attachment slots'
      this.attPanel.appendChild(noSlot)
      return
    }

    for (const slot of SLOT_ORDER) {
      if (!supportedSlots.includes(slot)) continue

      const hdr = document.createElement('div')
      hdr.className = 'att-slot-header'
      hdr.textContent = SLOT_LABEL[slot]
      this.attPanel.appendChild(hdr)

      const equipped = w.getAttachment(slot)
      if (equipped) {
        this.attPanel.appendChild(this.makeAttachRow(equipped, 'equipped', w, slot))
      }
      for (const att of AttachmentRegistry.bySlot(slot)) {
        if (equipped?.id === att.id) continue
        const canAfford = this.cash.cash >= att.cost
        this.attPanel.appendChild(this.makeAttachRow(att, canAfford ? 'buy' : 'cant-afford', w, slot))
      }
    }

    // ── Supplies section ──────────────────────────────────────────────────────
    const supHdr = document.createElement('div')
    supHdr.className = 'att-slot-header'
    supHdr.textContent = 'SUPPLIES'
    this.attPanel.appendChild(supHdr)

    this.attPanel.appendChild(this.makeSupplyRow(
      'Frag Grenade', `${this.grenades.count} carried`,
      '$50 · +1 grenade',
      50,
      () => { this.grenades.addGrenades(1); this.rebuildAttachPanel() },
    ))
  }

  private makeSupplyRow(
    name: string, subtext: string, desc: string,
    cost: number, onBuy: () => void,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'att-row'

    const info = document.createElement('div')
    Object.assign(info.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1' })
    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, { fontSize: '11px', color: '#d0d0d0' })
    nameEl.textContent = name
    const sub = document.createElement('div')
    Object.assign(sub.style, { fontSize: '9px', color: 'rgba(255,255,255,0.38)' })
    sub.textContent = subtext
    info.appendChild(nameEl); info.appendChild(sub)
    row.appendChild(info)

    const right = document.createElement('div')
    Object.assign(right.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' })
    const descEl = document.createElement('div')
    Object.assign(descEl.style, { fontSize: '9px', color: 'rgba(255,255,255,0.35)' })
    descEl.textContent = desc
    right.appendChild(descEl)

    const btn = document.createElement('button')
    const canAfford = this.cash.cash >= cost
    btn.className = 'att-buy-btn' + (canAfford ? '' : ' cant-afford')
    btn.textContent = `BUY $${cost}`
    if (canAfford) btn.addEventListener('click', () => {
      if (this.cash.spend(cost)) onBuy()
    })
    right.appendChild(btn)
    row.appendChild(right)
    return row
  }

  private makeAttachRow(
    att: AttachmentDef,
    mode: 'equipped' | 'buy' | 'cant-afford',
    w: WeaponBase,
    slot: AttachmentSlot,
  ): HTMLElement {
    const row = document.createElement('div')
    row.className = 'att-row'

    const info = document.createElement('div')
    Object.assign(info.style, { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' })

    const nameEl = document.createElement('div')
    Object.assign(nameEl.style, {
      fontSize: '11px', color: mode === 'equipped' ? '#6fef8f' : '#d0d0d0',
      fontWeight: mode === 'equipped' ? 'bold' : 'normal', whiteSpace: 'nowrap',
    })
    nameEl.textContent = att.name

    const descEl = document.createElement('div')
    Object.assign(descEl.style, { fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '.02em' })
    descEl.textContent = att.description

    info.appendChild(nameEl)
    info.appendChild(descEl)
    row.appendChild(info)

    const rightSide = document.createElement('div')
    Object.assign(rightSide.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: '0' })

    if (mode === 'equipped') {
      const equipped = document.createElement('div')
      Object.assign(equipped.style, { fontSize: '9px', color: '#6fef8f', letterSpacing: '.1em' })
      equipped.textContent = '✓ EQUIPPED'
      rightSide.appendChild(equipped)

      const unequipBtn = document.createElement('button')
      unequipBtn.className = 'att-buy-btn unequip'
      unequipBtn.textContent = 'REMOVE'
      unequipBtn.addEventListener('click', () => {
        w.removeAttachment(slot)
        this.rebuildAttachPanel()
      })
      rightSide.appendChild(unequipBtn)
    } else {
      const costEl = document.createElement('div')
      Object.assign(costEl.style, { fontSize: '10px', color: '#ffd700', letterSpacing: '.05em' })
      costEl.textContent = `$${att.cost}`
      rightSide.appendChild(costEl)

      const buyBtn = document.createElement('button')
      buyBtn.className = 'att-buy-btn' + (mode === 'cant-afford' ? ' cant-afford' : '')
      buyBtn.textContent = 'BUY'
      if (mode === 'buy') {
        buyBtn.addEventListener('click', () => {
          if (this.cash.spend(att.cost)) {
            w.equipAttachment(att)
            this.rebuildAttachPanel()
          }
        })
      }
      rightSide.appendChild(buyBtn)
    }

    row.appendChild(rightSide)
    return row
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
    const isSel = this.selected === slot
    card.style.borderColor = isSel ? '#ffc107' : 'rgba(255,255,255,0.12)'
    card.style.background  = isSel ? 'rgba(255,193,7,0.08)' : 'rgba(255,255,255,0.04)'
  }

  private fillSlotCard(card: HTMLElement, slot: 0 | 1 | 2): void {
    const labels = ['1  RIFLE / PRIMARY', '2  SECONDARY', '3  SIDEARM']
    const label = document.createElement('div')
    Object.assign(label.style, {
      fontSize: '9px', letterSpacing: '.14em',
      color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '2px',
    })
    label.textContent = labels[slot] ?? `SLOT ${slot + 1}`
    card.appendChild(label)

    const w = this.mgr.slots[slot]
    if (!w) {
      const empty = document.createElement('div')
      Object.assign(empty.style, { color: 'rgba(255,255,255,0.2)', fontSize: '13px', marginTop: '12px' })
      empty.textContent = '[ EMPTY ]'
      card.appendChild(empty)
    } else {
      this.appendWeaponInfo(card, w)
    }

    if (slot === this.mgr.getCurrentSlot() && w) {
      const dot = document.createElement('div')
      Object.assign(dot.style, {
        position: 'absolute', top: '10px', right: '12px',
        width: '6px', height: '6px', borderRadius: '50%', background: '#4caf50',
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

    const badge = document.createElement('div')
    Object.assign(badge.style, {
      fontSize: '9px', letterSpacing: '.12em', textTransform: 'uppercase', color: cc, marginBottom: '1px',
    })
    badge.textContent = w.getCategory()
    parent.appendChild(badge)

    const name = document.createElement('div')
    Object.assign(name.style, {
      fontSize: '14px', fontWeight: 'bold', letterSpacing: '.04em', color: '#fff', lineHeight: '1.2',
    })
    name.textContent = w.getName()
    parent.appendChild(name)

    const statsRow = document.createElement('div')
    Object.assign(statsRow.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginTop: '6px',
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

    // Show equipped attachments as compact chips
    const atts = w.getAttachments()
    if (atts.size > 0) {
      const chips = document.createElement('div')
      Object.assign(chips.style, { display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '5px' })
      for (const att of atts.values()) {
        const chip = document.createElement('span')
        Object.assign(chip.style, {
          fontSize: '8px', padding: '1px 5px', borderRadius: '2px',
          background: 'rgba(100,220,100,0.12)', color: 'rgba(100,220,100,0.8)',
          border: '1px solid rgba(100,220,100,0.25)', letterSpacing: '.06em',
        })
        chip.textContent = att.name
        chips.appendChild(chip)
      }
      parent.appendChild(chips)
    }
  }

  // ── Slot click logic ──────────────────────────────────────────────────────────

  private onSlotClick(slot: 0 | 1 | 2, _card: HTMLElement): void {
    if (this.selected === null) {
      this.selected = slot
    } else if (this.selected === slot) {
      this.selected = null
    } else {
      this.mgr.swapSlots(this.selected, slot)
      this.selected = null
    }
    this.rebuild()
  }
}
