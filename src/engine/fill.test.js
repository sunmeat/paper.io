import { describe, expect, it } from 'vitest';
import { captureArea } from './fill.js';
import { Grid } from './Grid.js';

describe('Grid', () => {
  it('stores ownership and trails in typed arrays', () => {
    const grid = new Grid(4, 3);
    grid.setOwner(2, 1, 3);
    grid.setTrail(1, 1, 1);

    expect(grid.owners).toBeInstanceOf(Uint8Array);
    expect(grid.trail).toBeInstanceOf(Uint8Array);
    expect(grid.ownerAt(2, 1)).toBe(3);
    expect(grid.trailAt(1, 1)).toBe(1);
    expect(grid.ownerAt(-1, 0)).toBe(0);
  });
});

describe('captureArea', () => {
  it('captures a simple enclosed square', () => {
    const grid = new Grid(7, 7);
    for (let x = 2; x <= 4; x++) {
      grid.setOwner(x, 1, 1);
      grid.setOwner(x, 5, 1);
    }
    for (let y = 2; y <= 4; y++) {
      grid.setOwner(1, y, 1);
      grid.setOwner(5, y, 1);
    }

    const captured = captureArea(grid, 1, []);

    expect(captured).toBe(9);
    expect(grid.ownerAt(3, 3)).toBe(1);
  });

  it('leaves an enclosed-looking area unclaimed when a hole connects it to the edge', () => {
    const grid = new Grid(7, 7);
    for (let x = 1; x <= 5; x++) {
      if (x !== 3) {
        grid.setOwner(x, 1, 1);
        grid.setOwner(x, 5, 1);
      }
    }
    for (let y = 2; y <= 4; y++) {
      grid.setOwner(1, y, 1);
      grid.setOwner(5, y, 1);
    }

    captureArea(grid, 1, []);

    expect(grid.ownerAt(3, 3)).toBe(0);
  });

  it('handles a trail running along the map boundary without reading outside the grid', () => {
    const grid = new Grid(4, 4);
    grid.setTrail(0, 0, 1);
    grid.setTrail(1, 0, 1);
    grid.setTrail(2, 0, 1);
    grid.setTrail(3, 0, 1);

    expect(() => captureArea(grid, 1, [0, 1, 2, 3])).not.toThrow();
    expect(grid.ownerAt(0, 0)).toBe(1);
    expect(grid.ownerAt(3, 0)).toBe(1);
  });

  it("preserves another player's trail when capturing adjacent cells", () => {
    const grid = new Grid(5, 5);
    grid.setOwner(1, 1, 1);
    grid.setTrail(2, 2, 1);
    grid.setTrail(3, 2, 2);

    captureArea(grid, 1, [grid.index(2, 2)]);

    expect(grid.trailAt(2, 2)).toBe(0);
    expect(grid.trailAt(3, 2)).toBe(2);
  });

  it('does not capture open cells connected to the edge', () => {
    const grid = new Grid(5, 5);
    grid.setOwner(2, 2, 1);

    captureArea(grid, 1, []);

    expect(grid.ownerAt(0, 0)).toBe(0);
    expect(grid.ownerAt(4, 4)).toBe(0);
  });
});
