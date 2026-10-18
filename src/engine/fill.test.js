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
  it('captures cells enclosed by the player territory', () => {
    const grid = new Grid(7, 7);
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) {
        if (x === 1 || x === 5 || y === 1 || y === 5) grid.setOwner(x, y, 1);
      }
    }

    const captured = captureArea(grid, 1, [grid.index(1, 1)]);

    expect(captured).toBe(9);
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) expect(grid.ownerAt(x, y)).toBe(1);
    }
    expect(grid.trailAt(1, 1)).toBe(0);
  });

  it('does not capture open cells connected to the edge', () => {
    const grid = new Grid(5, 5);
    grid.setOwner(2, 2, 1);

    captureArea(grid, 1, []);

    expect(grid.ownerAt(0, 0)).toBe(0);
    expect(grid.ownerAt(4, 4)).toBe(0);
  });
});
