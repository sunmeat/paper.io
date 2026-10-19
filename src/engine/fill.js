const workspaces = new Map();

export function captureArea(grid, owner, trailCells) {
  for (const index of trailCells) {
    grid.setOwnerAt(index, owner);
    if (grid.trail[index] !== 0) {
      grid.trail[index] = 0;
      grid.version++;
    }
  }

  const { width, height, owners, walkable } = grid;
  const capturedTrailOwners = new Set();
  let workspace = workspaces.get(owners.length);
  if (!workspace) {
    workspace = { visited: new Uint8Array(owners.length), queue: new Int32Array(owners.length) };
    workspaces.set(owners.length, workspace);
  }
  const { visited, queue } = workspace;
  visited.fill(0);
  let head = 0;
  let tail = 0;
  const enqueue = index => {
    if (!walkable[index] || visited[index] || owners[index] === owner) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (walkable[index] && grid.isEdge(x, y)) enqueue(index);
    }
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
    if (walkable[i] && !visited[i] && owners[i] !== owner) {
      grid.setOwnerAt(i, owner);
      if (grid.trail[i] && grid.trail[i] !== owner) capturedTrailOwners.add(grid.trail[i]);
      if (grid.trail[i] !== 0) { grid.trail[i] = 0; grid.version++; }
      captured++;
    }
  }
  grid.capturedTrailOwners = capturedTrailOwners;
  grid.clearTrail(owner);
  return captured;
}
