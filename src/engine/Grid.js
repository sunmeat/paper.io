/**
 * Flat typed-array grid with incrementally maintained territory counts.
 */
export class Grid {
  /**
   * @param {number} width Number of columns.
   * @param {number} height Number of rows.
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.owners = new Uint8Array(width * height);
    this.trail = new Uint8Array(width * height);
    this.territoryCounts = new Uint32Array(256);
    this.version = 0;
  }

  /** @returns {number} Flat index for a cell coordinate. */
  index(x, y) { return y * this.width + x; }

  /** @returns {boolean} Whether the coordinate is inside the map. */
  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  /** @returns {number} Owner ID or zero outside the map. */
  ownerAt(x, y) { return this.inside(x, y) ? this.owners[this.index(x, y)] : 0; }

  /** @returns {number} Trail owner ID or zero outside the map. */
  trailAt(x, y) { return this.inside(x, y) ? this.trail[this.index(x, y)] : 0; }

  /** @returns {number} Number of cells currently owned by the given player. */
  territoryCount(owner) { return this.territoryCounts[owner] || 0; }

  /** Changes a cell owner and updates both players' counts in O(1). */
  setOwnerAt(index, owner) {
    const previous = this.owners[index];
    if (previous === owner) return;
    if (previous) this.territoryCounts[previous]--;
    if (owner) this.territoryCounts[owner]++;
    this.owners[index] = owner;
    this.version++;
  }

  /** Sets a cell owner if the coordinate is inside the map. */
  setOwner(x, y, owner) {
    if (this.inside(x, y)) this.setOwnerAt(this.index(x, y), owner);
  }

  /** Sets a trail cell if the coordinate is inside the map. */
  setTrail(x, y, owner) { if (this.inside(x, y)) { const index=this.index(x,y); if(this.trail[index]!==owner){this.trail[index]=owner;this.version++;} } }

  /** Clears all trails, or only the selected owner's trail. */
  clearTrail(owner) {
    for (let i = 0; i < this.trail.length; i++) {
      if ((owner === undefined || this.trail[i] === owner) && this.trail[i] !== 0) { this.trail[i] = 0; this.version++; }
    }
  }

  /** Removes every territory cell owned by a player and returns its cell count. */
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
