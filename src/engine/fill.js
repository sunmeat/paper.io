const workspaces = new Map();

export function captureArea(grid, owner, trailCells) {
  const capturedTrailOwners = new Set();
  for (const index of trailCells) {
    if (!grid.walkable[index] || (grid.owners[index] && grid.owners[index] !== owner)) continue;
    const trailOwner = grid.trail[index];
    if (trailOwner && trailOwner !== owner) capturedTrailOwners.add(trailOwner);
    grid.setOwnerAt(index, owner);
    if (trailOwner) {
      grid.trail[index] = 0;
      grid.version++;
    }
  }

  const { width, height, owners, walkable } = grid;
  let workspace = workspaces.get(owners.length);
  if (!workspace) {
    workspace = {
      visited: new Uint8Array(owners.length),
      enemyVisited: new Uint8Array(owners.length),
      queue: new Int32Array(owners.length)
    };
    workspaces.set(owners.length, workspace);
  }
  const { visited, enemyVisited, queue } = workspace;
  visited.fill(0);
  let head = 0;
  let tail = 0;
  // The open sea is neutral territory. Rival-owned cells are solid barriers,
  // not tunnels that let the outside flood leak into a closed capture.
  const enqueue = index => {
    if (!walkable[index] || visited[index] || owners[index] !== 0) return;
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

  // Neutral cells cut off from the map edge are enclosed by the new territory.
  for (let i = 0; i < owners.length; i++) {
    if (walkable[i] && owners[i] === 0 && !visited[i]) captureCell(i);
  }

  // Rival land inside a closed capture is captured too, but a rival region
  // connected to the outside must remain theirs.
  enemyVisited.fill(0);
  for (let i = 0; i < owners.length; i++) {
    const rival = owners[i];
    if (!walkable[i] || !rival || rival === owner || enemyVisited[i]) continue;
    head = 0;
    tail = 0;
    queue[tail++] = i;
    enemyVisited[i] = 1;
    let touchesOutside = false;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (grid.isEdge(x, y)) touchesOutside = true;
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < width) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - width);
      if (y + 1 < height) neighbors.push(index + width);
      for (const neighbor of neighbors) {
        if (!walkable[neighbor]) continue;
        if (owners[neighbor] === 0 && visited[neighbor]) touchesOutside = true;
        if (owners[neighbor] === rival && !enemyVisited[neighbor]) {
          enemyVisited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    if (!touchesOutside) {
      for (let j = 0; j < tail; j++) captureCell(queue[j]);
    }
  }
  grid.capturedTrailOwners = capturedTrailOwners;
  grid.clearTrail(owner);
  return captured;
}
