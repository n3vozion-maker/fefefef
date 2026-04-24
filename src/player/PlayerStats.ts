export class PlayerStats {
  health = 100
  maxHealth = 100
  stamina = 100
  maxStamina = 100
  armour = 0

  applyDamage(amount: number): void {
    const absorbed = Math.min(this.armour, amount * 0.5)
    this.health = Math.max(0, this.health - (amount - absorbed))
  }

  isDead(): boolean {
    return this.health <= 0
  }
}
