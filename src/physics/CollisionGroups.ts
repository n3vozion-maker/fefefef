export const CollisionGroups = {
  TERRAIN:    0b0000_0001,
  PLAYER:     0b0000_0010,
  ENEMY:      0b0000_0100,
  PROJECTILE: 0b0000_1000,
  PROP:       0b0001_0000,
  TRIGGER:    0b0010_0000,
} as const
