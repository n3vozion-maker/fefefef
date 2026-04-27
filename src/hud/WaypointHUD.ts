import * as THREE from 'three'

// ── POI world positions for main mission "reach" objectives ───────────────────
export const MISSION_POI: Record<string, THREE.Vector3> = {
  reach_base_alpha:  new THREE.Vector3(  600,  0,  -400),
  reach_village_n:   new THREE.Vector3(  200,  0, -1180),
  reach_bunker_a:    new THREE.Vector3(  190,  0, -1210),
  reach_base_bravo:  new THREE.Vector3( -680,  0,   820),
  reach_crash_d:     new THREE.Vector3(  620,  0,  -390),
  reach_outpost_f:   new THREE.Vector3( 1090,  0,   120),
  reach_bunker_cmd:  new THREE.Vector3(  750,  0,   420),
  reach_bunker_deep: new THREE.Vector3( -850,  0,  -700),
  reach_outpost_g:   new THREE.Vector3( -890,  0,  -180),
}

// Detection radius — player within this distance triggers completion
export const POI_REACH_RADIUS = 32

// ── WaypointHUD ───────────────────────────────────────────────────────────────

export class WaypointHUD {
  private container: HTMLElement
  private iconEl:    HTMLElement
  private labelEl:   HTMLElement
  private distEl:    HTMLElement

  constructor() {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes wp-pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
      .wp-root { pointer-events:none; user-select:none; }
      .wp-marker {
        position:fixed; display:flex; flex-direction:column; align-items:center;
        gap:3px; transform:translateX(-50%); transition:left 0.08s,top 0.08s;
        animation:wp-pulse 2.2s ease-in-out infinite;
      }
      .wp-icon {
        font-size:20px; color:#ffdd55; text-shadow:0 0 10px #ffaa00,0 0 22px #ff8800;
        line-height:1;
      }
      .wp-label {
        font-family:monospace; font-size:10px; color:rgba(255,220,80,0.85);
        letter-spacing:.1em; text-transform:uppercase; white-space:nowrap;
        background:rgba(0,0,0,0.5); padding:1px 6px;
      }
      .wp-dist {
        font-family:monospace; font-size:9px; color:rgba(255,200,60,0.65);
        letter-spacing:.08em;
      }
      .wp-edge {
        font-size:16px; color:#ffdd55;
        text-shadow:0 0 8px #ffaa00;
      }
    `
    document.head.appendChild(style)

    this.container = document.createElement('div')
    this.container.className = 'wp-root'
    Object.assign(this.container.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '30',
    })
    document.body.appendChild(this.container)

    // Marker element
    const marker = document.createElement('div')
    marker.className = 'wp-marker'
    this.container.appendChild(marker)

    this.iconEl  = document.createElement('div'); this.iconEl.className  = 'wp-icon'
    this.labelEl = document.createElement('div'); this.labelEl.className = 'wp-label'
    this.distEl  = document.createElement('div'); this.distEl.className  = 'wp-dist'
    marker.appendChild(this.iconEl)
    marker.appendChild(this.labelEl)
    marker.appendChild(this.distEl)

    this.hide()
  }

  hide(): void { this.container.style.display = 'none' }

  /**
   * Call every frame.
   * @param playerPos  player world position
   * @param yaw        camera yaw in radians (from PlayerCamera.getYaw)
   * @param target     world position of the waypoint, or null to hide
   * @param label      short objective label
   */
  tick(
    playerPos: THREE.Vector3,
    yaw:       number,
    target:    THREE.Vector3 | null,
    label:     string,
  ): void {
    if (!target) { this.hide(); return }
    this.container.style.display = 'block'

    const dx   = target.x - playerPos.x
    const dz   = target.z - playerPos.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    this.distEl.textContent  = `${Math.round(dist)} m`
    this.labelEl.textContent = label

    // Angle from world −Z axis to target
    const targetAngle = Math.atan2(dx, -dz)
    // Relative angle to camera facing
    const rel = normalizeAngle(targetAngle - yaw)

    const HALF_FOV = Math.PI * 0.52   // ~94° half-angle feels right

    if (Math.abs(rel) < HALF_FOV) {
      // Target is roughly in front — project to screen centre strip
      const t = rel / HALF_FOV                  // −1 … +1
      const sx = 50 + t * 38                    // 12 % … 88 %
      const marker = this.container.firstElementChild as HTMLElement
      marker.style.left = `${sx}%`
      marker.style.top  = '9%'
      this.iconEl.textContent = '◆'
      this.iconEl.className   = 'wp-icon'
    } else {
      // Off-screen — show edge arrow
      const marker = this.container.firstElementChild as HTMLElement
      if (rel > 0) {
        marker.style.left = '94%'; marker.style.top = '50%'
        this.iconEl.textContent = '▶'
      } else {
        marker.style.left = '3%'; marker.style.top = '50%'
        this.iconEl.textContent = '◀'
      }
      this.iconEl.className = 'wp-icon wp-edge'
    }
  }
}

function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}
