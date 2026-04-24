import { getTerrainHeight, getVegetationDensity, getWarmth } from './TerrainNoise'

export type BiomeType = 'plains' | 'forest' | 'mountain' | 'urban' | 'desert' | 'ruins' | 'snow'

// Urban zones defined here so BiomeSystem can query them without a circular import
export interface UrbanZone { x: number; z: number; radius: number }

const URBAN_ZONES: UrbanZone[] = [
  { x:  600, z: -400, radius: 220 },   // Firebase Alpha
  { x: -700, z:  800, radius: 220 },   // Firebase Bravo
  { x:  200, z:-1200, radius: 130 },   // Northern Ruins
  { x: 1100, z:  100, radius: 100 },   // Eastern Settlement
  { x: -900, z: -200, radius: 110 },   // Western Village
  { x: -300, z:  500, radius:  70 },   // Bunker Complex
  { x:  700, z: -700, radius:  70 },   // Command Bunker
]

export function getBiome(wx: number, wz: number): BiomeType {
  for (const zone of URBAN_ZONES) {
    const dx = wx - zone.x, dz = wz - zone.z
    if (dx * dx + dz * dz < zone.radius * zone.radius) return 'urban'
  }

  const h       = getTerrainHeight(wx, wz)
  const density = getVegetationDensity(wx, wz)
  const warmth  = getWarmth(wx, wz)

  if (h > 200) return 'snow'
  if (h > 110) return 'mountain'
  if (h >  60) return density > 0.45 ? 'forest' : 'mountain'
  if (warmth < 0.28) return 'desert'
  if (density > 0.55) return 'forest'
  return 'plains'
}

interface RGB { r: number; g: number; b: number }

export function getBiomeColor(biome: BiomeType, height: number): RGB {
  switch (biome) {
    case 'snow':     return blend({ r: 0.88, g: 0.92, b: 0.96 }, { r: 0.60, g: 0.57, b: 0.55 }, (height - 200) / 90)
    case 'mountain': return { r: 0.55, g: 0.52, b: 0.50 }
    case 'forest':   return height > 50
                       ? { r: 0.22, g: 0.44, b: 0.20 }
                       : { r: 0.28, g: 0.52, b: 0.24 }
    case 'plains':   return { r: 0.42, g: 0.60, b: 0.30 }
    case 'urban':    return { r: 0.58, g: 0.55, b: 0.50 }
    case 'ruins':    return { r: 0.52, g: 0.50, b: 0.46 }
    case 'desert':   return { r: 0.82, g: 0.72, b: 0.50 }
    default:         return { r: 0.5, g: 0.5, b: 0.5 }
  }
}

function blend(a: RGB, b: RGB, t: number): RGB {
  t = Math.max(0, Math.min(1, t))
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}
