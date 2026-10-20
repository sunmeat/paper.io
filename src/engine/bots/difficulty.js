export const BOT_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ reactionTicks: 6, vision: 2, risk: 0.08, expedition: 5, attack: true, mistakeChance: 0.12, attackCooldownTicks: 18 }),
  normal: Object.freeze({ reactionTicks: 4, vision: 4, risk: 0.22, expedition: 9, attack: true, mistakeChance: 0.07, attackCooldownTicks: 14 }),
  hard: Object.freeze({ reactionTicks: 3, vision: 7, risk: 0.38, expedition: 14, attack: true, mistakeChance: 0.035, attackCooldownTicks: 12 })
});

export const BOT_PERSONALITIES = Object.freeze({
  greedy: Object.freeze({ name: 'Грин', label: 'жадный', expeditionBias: 1.35, homeBias: 0.65, huntBias: 0.55, mistakeBias: 1.1 }),
  cautious: Object.freeze({ name: 'Тихон', label: 'осторожный', expeditionBias: 0.65, homeBias: 1.6, huntBias: 0.25, mistakeBias: 0.55 }),
  hunter: Object.freeze({ name: 'Рысь', label: 'охотник', expeditionBias: 0.9, homeBias: 0.9, huntBias: 1.8, mistakeBias: 0.75, targetDelayTicks: 3 })
});

export const BOT_PERSONALITY_IDS = Object.freeze(Object.keys(BOT_PERSONALITIES));

export function getBotDifficulty({ playerLevel = 1, winStreak = 0, lossStreak = 0 } = {}) {
  const pressure = Math.max(1, playerLevel) + Math.min(3, Math.max(0, winStreak)) - Math.min(2, Math.max(0, lossStreak));
  if (pressure >= 7) return 'hard';
  if (pressure >= 3) return 'normal';
  return 'easy';
}
