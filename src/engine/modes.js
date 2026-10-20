export const GAME_MODES = Object.freeze({
  classic: {
    id: 'classic',
    title: { ru: 'Классика', en: 'Classic' },
    description: { ru: 'Захвати 90% карты или переживи всех соперников.', en: 'Capture 90% of the map or outlast every rival.' },
    config: { moveIntervalMs: 125, worldWidth: 90, worldHeight: 90, botCount: 10 },
    powerups: false,
    targetTerritory: 90,
    timeLimitMs: null
  },
  sprint: {
    id: 'sprint',
    title: { ru: 'Спринт · 3 мин', en: 'Sprint · 3 min' },
    description: { ru: 'За три минуты захвати больше территории, чем соперники.', en: 'Claim more territory than rivals in three minutes.' },
    config: { moveIntervalMs: 125, worldWidth: 80, worldHeight: 80, botCount: 8 },
    powerups: true,
    targetTerritory: null,
    timeLimitMs: 180000
  }
});

export function evaluateRoundOutcome({ modeId = 'classic', elapsedMs = 0, playerAlive = true, playerTerritory = 0, topTerritory = 0, aliveBots = 1 }) {
  if (!playerAlive) return 'defeat';
  const mode = GAME_MODES[modeId] || GAME_MODES.classic;
  if (mode.targetTerritory != null && playerTerritory >= mode.targetTerritory) return 'victory';
  if (mode.id === 'classic' && aliveBots === 0) return 'victory';
  if (mode.timeLimitMs != null && elapsedMs >= mode.timeLimitMs) return playerTerritory >= topTerritory ? 'victory' : 'defeat';
  return null;
}
