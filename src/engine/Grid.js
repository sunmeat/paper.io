/**
 * Flat typed-array grid with an explicit walkable mask and incremental territory counts.
 */
export class Grid {
  constructor(width, height, walkable = null) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.walkable = walkable ? Uint8Array.from(walkable, value => value ? 1 : 0) : new Uint8Array(size).fill(1);
    if (this.walkable.length !== size) throw new RangeError('Walkable mask dimensions do not match the grid.');
    this.owners = new Uint8Array(size);
    this.trail = new Uint8Array(size);
    this.territoryCounts = new Uint32Array(256);
    this.walkableCount = this.walkable.reduce((sum, value) => sum + value, 0);
    this.version = 0;
  }

  index(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  inside(x, y) { return this.inBounds(x, y) && this.walkable[this.index(x, y)] === 1; }
  isWalkable(x, y) { return this.inside(x, y); }

  isEdge(x, y) {
    return !this.inside(x, y) || !this.inside(x - 1, y) || !this.inside(x + 1, y) ||
      !this.inside(x, y - 1) || !this.inside(x, y + 1);
  }

  ownerAt(x, y) { return this.inside(x, y) ? this.owners[this.index(x, y)] : 0; }
  trailAt(x, y) { return this.inside(x, y) ? this.trail[this.index(x, y)] : 0; }
  territoryCount(owner) { return this.territoryCounts[owner] || 0; }

  setOwnerAt(index, owner) {
    if (!this.walkable[index]) return;
    const previous = this.owners[index];
    if (previous === owner) return;
    if (previous) this.territoryCounts[previous]--;
    if (owner) this.territoryCounts[owner]++;
    this.owners[index] = owner;
    this.version++;
  }

  setOwner(x, y, owner) {
    if (this.inside(x, y)) this.setOwnerAt(this.index(x, y), owner);
  }

  setTrail(x, y, owner) {
    if (!this.inside(x, y)) return;
    const index = this.index(x, y);
    if (this.trail[index] !== owner) {
      this.trail[index] = owner;
      this.version++;
    }
  }

  clearTrail(owner) {
    for (let i = 0; i < this.trail.length; i++) {
      if ((owner === undefined || this.trail[i] === owner) && this.trail[i] !== 0) {
        this.trail[i] = 0;
        this.version++;
      }
    }
  }

  clearTerritory(owner) {
    let removed = 0;
    for (let i = 0; i < this.owners.length; i++) {
      if (this.owners[i] === owner) {
        this.setOwnerAt(i, 0);
        removed++;
      }
    }
    return removed;
  }
}
