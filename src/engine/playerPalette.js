export const PLAYER_PALETTE = Object.freeze([
  '#9b7bff', '#ff6685', '#ffbd59', '#42d9c0', '#65a8ff', '#f58bdf',
  '#a6e36f', '#ff8d5e', '#7de0ff', '#e4dc6a', '#c4a1ff'
]);

function rgb(hex) {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

function colorDistance(left, right) {
  const a = rgb(left), b = rgb(right);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

export function getPlayerColor(playerId, avoidColor = null) {
  const start = Math.abs(Number(playerId) - 1) % PLAYER_PALETTE.length;
  for (let offset = 0; offset < PLAYER_PALETTE.length; offset++) {
    const candidate = PLAYER_PALETTE[(start + offset) % PLAYER_PALETTE.length];
    if (!avoidColor || colorDistance(candidate, avoidColor) >= 125) return candidate;
  }
  return PLAYER_PALETTE[start];
}
