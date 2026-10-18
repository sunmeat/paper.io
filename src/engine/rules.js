/**
 * Returns the ID of the player whose exposed trail was crossed.
 * @param {number} movingPlayerId Player entering a trail cell.
 * @param {number} trailOwnerId Owner of that trail.
 * @returns {number} The player that must be eliminated.
 */
export function resolveTrailCrossing(movingPlayerId, trailOwnerId) {
  return movingPlayerId === trailOwnerId ? movingPlayerId : trailOwnerId;
}

/**
 * Resolves a head-on collision. The player with the longer exposed trail loses;
 * equal trail lengths eliminate both players.
 * @param {{id:number,trailCells:number[]}} first First player.
 * @param {{id:number,trailCells:number[]}} second Second player.
 * @returns {number[]} IDs of players that lose the collision.
 */
export function resolveHeadCollision(first, second) {
  const firstLength = first.trailCells.length;
  const secondLength = second.trailCells.length;
  if (firstLength === secondLength) return [first.id, second.id];
  return [firstLength > secondLength ? first.id : second.id];
}
