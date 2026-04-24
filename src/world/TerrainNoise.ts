// ── Low-level noise ───────────────────────────────────────────────────────────

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = x - ix,        fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  return lerp(
    lerp(hash(ix, iz),     hash(ix + 1, iz),     ux),
    lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), ux),
    uz,
  )
}

function octave(x: number, z: number, octs: number, persist: number, lacun: number): number {
  let v = 0, amp = 1, freq = 1, max = 0
  for (let i = 0; i < octs; i++) {
    v    += smoothNoise(x * freq, z * freq) * amp
    max  += amp
    amp  *= persist
    freq *= lacun
  }
  return v / max
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

// ── Public API ────────────────────────────────────────────────────────────────

const MOUNTAIN_SCALE  = 1_100
const DETAIL_SCALE    = 160
const WARP_STRENGTH   = 220
const MAX_HEIGHT      = 290

/** World-space terrain height in metres. */
export function getTerrainHeight(wx: number, wz: number): number {
  // Domain-warped mountain noise — produces natural-looking ridges
  const sx = wx / MOUNTAIN_SCALE
  const sz = wz / MOUNTAIN_SCALE
  const warpX = smoothNoise(sx + 0.3, sz + 9.2) * 2 - 1
  const warpZ = smoothNoise(sx + 8.3, sz + 2.8) * 2 - 1
  const mountain = octave(sx + warpX, sz + warpZ, 6, 0.52, 2.1)
  const peaks    = Math.pow(Math.max(0, mountain - 0.35) / 0.65, 2.5) * MAX_HEIGHT

  // Fine surface detail
  const detail = (octave(wx / DETAIL_SCALE, wz / DETAIL_SCALE, 4, 0.5, 2.0) - 0.5) * 14

  return Math.max(0, peaks + detail)
}

/** 0–1 vegetation density at this world position. */
export function getVegetationDensity(wx: number, wz: number): number {
  return smoothNoise(wx / 320 + 100, wz / 320 + 100)
}

/** 0–1 "warmth" factor (low = colder/northern, high = warmer/desert) */
export function getWarmth(wx: number, wz: number): number {
  return smoothNoise(wx / 1_200 + 50, wz / 1_200 + 50)
}
