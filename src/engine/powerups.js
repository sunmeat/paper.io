export const POWERUPS = Object.freeze([
  { id: 'speed', icon: '⚡', durationTicks: 100 },
  { id: 'shield', icon: '🛡️', durationTicks: 100 },
  { id: 'bigCapture', icon: '💥', durationTicks: 1 },
  { id: 'freeze', icon: '❄️', durationTicks: 45 }
]);

export const POWERUP_IDS = Object.freeze(POWERUPS.map(powerup => powerup.id));
export const POWERUP_SPAWN_INTERVAL = 45;
export const POWERUP_MAX_PICKUPS = 3;
export const POWERUP_LIFETIME_TICKS = 215;
