/**
 * Flat typed-array grid for territory ownership and active trails.
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
  }

  /** @returns {number} Flat index for a cell coordinate. */
  index(x, y) { return y * this.width + x; }

  /** @returns {boolean} Whether the coordinate is inside the map. */
  inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  /** @returns {number} Owner ID or zero outside the map. */
  ownerAt(x, y) { return this.inside(x, y) ? this.owners[this.index(x, y)] : 0; }

  /** @returns {number} Trail owner ID or zero outside the map. */
  trailAt(x, y) { return this.inside(x, y) ? this.trail[this.index(x, y)] : 0; }

  /** Sets a cell owner if the coordinate is inside the map. */
  setOwner(x, y, owner) { if (this.inside(x, y)) this.owners[this.index(x, y)] = owner; }

  /** Sets a trail cell if the coordinate is inside the map. */
  setTrail(x, y, owner) { if (this.inside(x, y)) this.trail[this.index(x, y)] = owner; }

  /** Clears all trails, or only the selected owner's trail. */
  clearTrail(owner) {
    for (let i = 0; i < this.trail.length; i++) {
      if (owner === undefined || this.trail[i] === owner) this.trail[i] = 0;
    }
  }
}
