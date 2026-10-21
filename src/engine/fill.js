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
      if (x > 0) {
        const neighbor = index - 1;
        if (walkable[neighbor] && owners[neighbor] === owner && !labels[neighbor]) {
          labels[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
      }
      if (x + 1 < width) {
        const neighbor = index + 1;
        if (walkable[neighbor] && owners[neighbor] === owner && !labels[neighbor]) {
          labels[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
      }
      if (y > 0) {
        const neighbor = index - width;
        if (walkable[neighbor] && owners[neighbor] === owner && !labels[neighbor]) {
          labels[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
      }
      if (y + 1 < height) {
        const neighbor = index + width;
        if (walkable[neighbor] && owners[neighbor] === owner && !labels[neighbor]) {
          labels[neighbor] = componentId;
          queue[tail++] = neighbor;
        }
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

/** Widest neutral channel (in cells) that is closed so territory stays solid. */
export const MAX_FILLED_GAP = 2;

/**
 * Claims narrow neutral slits that sit between two cells of the same owner.
 * Flood fill only seals areas that are fully enclosed; a 1-2 cell wide inlet is
 * open to the outside, so it used to stay unclaimed and show up as a thin stripe
 * inside the territory. Only plain neutral cells are claimed: rival land, trails
 * and unwalkable cells are never touched.
 *
 * `bounds` limits the scan to a rectangle (cell coordinates). With `owner` set,
 * only that player's slits are closed; otherwise every owner's are.
 * Returns the number of claimed cells.
 */
export function fillNarrowGaps(grid, bounds, { owner = 0, maxGap = MAX_FILLED_GAP } = {}) {
  const { width, height, owners, trail, walkable } = grid;
  const minX = Math.max(0, bounds.minX - maxGap - 1);
  const maxX = Math.min(width - 1, bounds.maxX + maxGap + 1);
  const minY = Math.max(0, bounds.minY - maxGap - 1);
  const maxY = Math.min(height - 1, bounds.maxY + maxGap + 1);
  const isNeutral = index => walkable[index] === 1 && owners[index] === 0 && trail[index] === 0;
  const landOwner = index => (walkable[index] === 1 && (!owner || owners[index] === owner) ? owners[index] : 0);

  // Walks from a neutral cell along one axis. The cell is part of a narrow slit
  // when the neutral run is at most maxGap long and the same owner's land closes
  // both ends. Returns that owner's id, or 0.
  const sealedAlong = (x, y, stepX, stepY) => {
    let before = 0;
    let cx = x - stepX, cy = y - stepY;
    while (before < maxGap && cx >= 0 && cy >= 0 && cx < width && cy < height && isNeutral(cy * width + cx)) {
      before++; cx -= stepX; cy -= stepY;
    }
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return 0;
    const first = landOwner(cy * width + cx);
    if (!first) return 0;
    let after = 0;
    cx = x + stepX; cy = y + stepY;
    while (before + after + 1 < maxGap + 1 && cx >= 0 && cy >= 0 && cx < width && cy < height && isNeutral(cy * width + cx)) {
      after++; cx += stepX; cy += stepY;
    }
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return 0;
    return landOwner(cy * width + cx) === first && before + after + 1 <= maxGap ? first : 0;
  };

  let claimed = 0;
  // Filling one slit can narrow a neighbouring one, so repeat until stable.
  for (let pass = 0; pass < 3; pass++) {
    const fillIndices = [];
    const fillOwners = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const index = y * width + x;
        if (!isNeutral(index)) continue;
        const slitOwner = sealedAlong(x, y, 1, 0) || sealedAlong(x, y, 0, 1);
        if (slitOwner) { fillIndices.push(index); fillOwners.push(slitOwner); }
      }
    }
    if (!fillIndices.length) break;
    for (let i = 0; i < fillIndices.length; i++) grid.setOwnerAt(fillIndices[i], fillOwners[i]);
    claimed += fillIndices.length;
  }
  return claimed;
}

export function captureArea(grid, owner, trailCells) {
  const capturedTrailOwners = new Set();
  const bounds = { minX: grid.width, maxX: 0, minY: grid.height, maxY: 0 };
  for (const index of trailCells) {
    if (!grid.walkable[index]) continue;
    const tx = index % grid.width, ty = Math.floor(index / grid.width);
    if (tx < bounds.minX) bounds.minX = tx;
    if (tx > bounds.maxX) bounds.maxX = tx;
    if (ty < bounds.minY) bounds.minY = ty;
    if (ty > bounds.maxY) bounds.maxY = ty;

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
  if (bounds.minX <= bounds.maxX) captured += fillNarrowGaps(grid, bounds, { owner });
  retainLargestTerritoryComponents(grid);
  return captured;
}
