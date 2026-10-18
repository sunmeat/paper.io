export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.owners = new Uint8Array(width * height);
    this.trail = new Uint8Array(width * height);
  }

  index(x, y) {
    return y * this.width + x;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  ownerAt(x, y) {
    return this.inside(x, y) ? this.owners[this.index(x, y)] : 0;
  }

  trailAt(x, y) {
    return this.inside(x, y) ? this.trail[this.index(x, y)] : 0;
  }

  setOwner(x, y, owner) {
    if (this.inside(x, y)) this.owners[this.index(x, y)] = owner;
  }

  setTrail(x, y, owner) {
    if (this.inside(x, y)) this.trail[this.index(x, y)] = owner;
  }

  clearTrail(owner) {
    for (let i = 0; i < this.trail.length; i++) {
      if (owner === undefined || this.trail[i] === owner) this.trail[i] = 0;
    }
  }
}
