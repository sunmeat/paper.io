/**
 * Finds a live rival whose exposed trail occupies the exact target cell.
 * @param {number} cellIndex Target grid index.
 * @param {number} playerId Moving player's ID.
 * @param {Iterable<{id:number, alive:boolean, trailCells:number[]}>} players Players to check.
 * @returns {{id:number, alive:boolean, trailCells:number[]} | null}
 */
export function findTrailCollision(cellIndex, playerId, players) {
  return [...players].find(player =>
    player.id !== playerId &&
    player.alive &&
    player.trailCells.includes(cellIndex)
  ) ?? null;
}
