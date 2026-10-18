const workspaces = new Map();

/**
 * Closes a trail and captures all cells unreachable from the map boundary.
 * Capturing rival cells transfers ownership and updates incremental counts.
 * @param {import('./Grid.js').Grid} grid Grid to update.
 * @param {number} owner Player ID.
 * @param {number[]} trailCells Indices forming the closed trail.
 * @returns {number} Number of newly acquired cells, excluding trail cells.
 */
export function captureArea(grid, owner, trailCells) {
  for (const index of trailCells) {
    grid.setOwnerAt(index, owner);
    grid.trail[index] = 0;
  }

  const { width, height, owners } = grid;
  let workspace = workspaces.get(owners.length);
  if (!workspace) { workspace = { visited: new Uint8Array(owners.length), queue: new Int32Array(owners.length) }; workspaces.set(owners.length, workspace); }
  const { visited, queue } = workspace;
  visited.fill(0);
  let head = 0;
  let tail = 0;

  const enqueue = index => {
    if (visited[index] || owners[index] === owner) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  let captured = 0;
  for (let i = 0; i < owners.length; i++) {
    if (!visited[i] && owners[i] !== owner) {
      grid.setOwnerAt(i, owner);
      captured++;
    }
  }
  grid.clearTrail(owner);
  return captured;
}
