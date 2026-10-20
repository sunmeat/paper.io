const workspaces = new Map();

export function retainLargestTerritoryComponents(grid) {
  const { owners, walkable, width, height } = grid;
  let workspace = workspaces.get(owners.length);
  if (!workspace || !workspace.labels) {
    workspace = {
      ...workspace,
      labels: new Uint32Array(owners.length),
      queue: workspace?.queue || new Int32Array(owners.length)
    };
    workspaces.set(owners.length, workspace);
  }

  const { labels, queue } = workspace;
  labels.fill(0);
  const largestByOwner = new Map();
  let componentId = 0;

  for (let start = 0; start < owners.length; start++) {
    const owner = owners[start];
    if (!walkable[start] || !owner || labels[start]) continue;

    componentId++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = componentId;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || !walkable[neighbor] || owners[neighbor] !== owner || labels[neighbor]) continue;
        labels[neighbor] = componentId;
        queue[tail++] = neighbor;
      }
    }

    const previousLargest = largestByOwner.get(owner);
    if (!previousLargest || tail > previousLargest.size) {
      largestByOwner.set(owner, { id: componentId, size: tail });
    }
  }

  let neutralized = 0;
  for (let index = 0; index < owners.length; index++) {
    const owner = owners[index];
    if (!owner) continue;
    const largest = largestByOwner.get(owner);
    if (largest && labels[index] !== largest.id) {
      grid.setOwnerAt(index, 0);
      neutralized++;
    }
  }

  return neutralized;
}

export function captureArea(grid, owner, trailCells) {
  const capturedTrailOwners = new Set();
  for (const index of trailCells) {
    if (!grid.walkable[index]) continue;

    const trailOwner = grid.trail[index];
    // Ignore stale trail indices that point at ordinary rival territory.
    if (grid.owners[index] && grid.owners[index] !== owner && !trailOwner) continue;
    if (trailOwner && trailOwner !== owner) capturedTrailOwners.add(trailOwner);

    // The player's trail is the new border even when it crosses rival land.
    // Leaving an enemy-owned trail cell unchanged creates a hole in the loop.
    grid.setOwnerAt(index, owner);
    if (trailOwner) {
      grid.trail[index] = 0;
      grid.version++;
    }
  }

  const { width, height, owners, walkable } = grid;
  let workspace = workspaces.get(owners.length);
  if (!workspace || !workspace.visited) {
    workspace = {
      ...workspace,
      visited: new Uint8Array(owners.length),
      queue: new Int32Array(owners.length)
    };
    workspaces.set(owners.length, workspace);
  }
  const { visited, queue } = workspace;
  visited.fill(0);
  let head = 0;
  let tail = 0;

  // Everything not owned by the capturing player, including rival territory,
  // is traversable by the outside flood-fill. Only cells sealed by our border
  // are claimed, so connected enemy land outside the loop stays untouched.
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
  const captureCell = index => {
    if (grid.trail[index] && grid.trail[index] !== owner) capturedTrailOwners.add(grid.trail[index]);
    grid.setOwnerAt(index, owner);
    if (grid.trail[index] !== 0) {
      grid.trail[index] = 0;
      grid.version++;
    }
    captured++;
  };

  for (let i = 0; i < owners.length; i++) {
    if (walkable[i] && owners[i] !== owner && !visited[i]) captureCell(i);
  }

  grid.capturedTrailOwners = capturedTrailOwners;
  grid.clearTrail(owner);
  retainLargestTerritoryComponents(grid);
  return captured;
}
