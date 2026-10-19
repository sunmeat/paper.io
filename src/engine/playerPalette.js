export const PLAYER_PALETTE = Object.freeze([
  '#9b7bff', '#ff6685', '#ffbd59', '#42d9c0', '#65a8ff', '#f58bdf',
  '#a6e36f', '#ff8d5e', '#7de0ff', '#e4dc6a', '#c4a1ff'
]);

export function getPlayerColor(playerId) {
  return PLAYER_PALETTE[(playerId - 1) % PLAYER_PALETTE.length];
}
