let _playerDamageMult = 1

export function setPlayerDamageMult(mult: number): void {
  _playerDamageMult = mult
}

export function calculateDamage(baseDamage: number, range: number, effectiveRange: number, armour: number): number {
  const falloff = Math.max(0, 1 - Math.max(0, range - effectiveRange) / effectiveRange)
  const raw = baseDamage * falloff * _playerDamageMult
  return Math.max(1, raw - armour * 0.3)
}
