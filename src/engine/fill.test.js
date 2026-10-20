import { describe, expect, it } from 'vitest';
import { captureArea } from './fill.js';
import { Grid } from './Grid.js';
import { MAPS, createMapMask } from './maps.js';

describe('Grid', () => {
  it('treats non-walkable mask cells as outside', () => {
    const grid = new Grid(3, 3, [0,0,0,0,1,0,0,0,0]);
    grid.setOwner(0, 0, 1);
    grid.setTrail(2, 2, 1);
    grid.setOwner(1, 1, 1);
    expect(grid.inside(0, 0)).toBe(false);
    expect(grid.ownerAt(0, 0)).toBe(0);
    expect(grid.trailAt(2, 2)).toBe(0);
    expect(grid.territoryCount(1)).toBe(1);
    expect(grid.walkableCount).toBe(1);
  });

  it('recognizes narrow isthmuses and separate islands', () => {
    const mask = new Uint8Array(9 * 7);
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 3; x++) mask[y * 9 + x] = 1;
      for (let x = 5; x <= 7; x++) mask[y * 9 + x] = 1;
    }
    mask[3 * 9 + 4] = 1;
    const grid = new Grid(9, 7, mask);
    expect(grid.inside(4, 3)).toBe(true);
    expect(grid.inside(4, 2)).toBe(false);
    expect(grid.isEdge(4, 3)).toBe(true);
    expect(grid.inside(2, 3)).toBe(true);
    expect(grid.inside(6, 3)).toBe(true);
  });

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
  it('fills every cell in a closed rectangular capture without a one-cell gap', () => {
    const grid = new Grid(9, 9);
    const trail = [];
    for (let x = 2; x <= 6; x++) {
      grid.setTrail(x, 2, 1); trail.push(grid.index(x, 2));
      grid.setTrail(x, 6, 1); trail.push(grid.index(x, 6));
    }
    for (let y = 3; y <= 5; y++) {
      grid.setTrail(2, y, 1); trail.push(grid.index(2, y));
      grid.setTrail(6, y, 1); trail.push(grid.index(6, y));
    }
    const captured = captureArea(grid, 1, trail);
    for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) {
      expect(grid.ownerAt(x, y)).toBe(1);
    }
    expect(captured).toBe(9);
    expect(grid.territoryCount(1)).toBe(25);
  });

  it('does not overwrite an opponent cell from a stale trail index', () => {
    const grid = new Grid(5, 5);
    grid.setOwner(0, 2, 2);
    captureArea(grid, 1, [grid.index(0, 2)]);
    expect(grid.ownerAt(0, 2)).toBe(2);
  });

  it('closes a loop when an opponent trail occupies one of the recorded loop cells', () => {
    const grid = new Grid(7, 7);
    const trail = [];
    for (let x = 1; x <= 5; x++) {
      const top = grid.index(x, 1);
      const bottom = grid.index(x, 5);
      grid.setTrail(x, 1, 1);
      grid.setTrail(x, 5, 1);
      trail.push(top, bottom);
    }
    for (let y = 2; y <= 4; y++) {
      const left = grid.index(1, y);
      const right = grid.index(5, y);
      grid.setTrail(1, y, 1);
      grid.setTrail(5, y, 1);
      trail.push(left, right);
    }
    grid.setTrail(3, 1, 2);

    captureArea(grid, 1, trail);

    expect(grid.ownerAt(3, 3)).toBe(1);
    expect(grid.ownerAt(3, 1)).toBe(1);
    expect(grid.trailAt(3, 1)).toBe(0);
    expect(grid.capturedTrailOwners.has(2)).toBe(true);
  });

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

  it('flood-fills from mask edges and leaves disconnected islands exposed', () => {
    const mask = new Uint8Array(9 * 7);
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 3; x++) mask[y * 9 + x] = 1;
      for (let x = 5; x <= 7; x++) mask[y * 9 + x] = 1;
    }
    const grid = new Grid(9, 7, mask);
    for (let x = 1; x <= 3; x++) {
      grid.setOwner(x, 1, 1);
      grid.setOwner(x, 5, 1);
    }
    for (let y = 2; y <= 4; y++) {
      grid.setOwner(1, y, 1);
      grid.setOwner(3, y, 1);
    }

    captureArea(grid, 1, []);

    expect(grid.ownerAt(2, 3)).toBe(1);
    expect(grid.ownerAt(6, 3)).toBe(0);
    expect(grid.walkableCount).toBe(30);
  });

  it('clears an opponent trail enclosed by a successful capture', () => {
    const grid = new Grid(7, 7);
    for (let x = 1; x <= 5; x++) { grid.setOwner(x, 1, 1); grid.setOwner(x, 5, 1); }
    for (let y = 2; y <= 4; y++) { grid.setOwner(1, y, 1); grid.setOwner(5, y, 1); }
    grid.setTrail(3, 3, 2);
    captureArea(grid, 1, []);
    expect(grid.ownerAt(3, 3)).toBe(1);
    expect(grid.trailAt(3, 3)).toBe(0);
    expect(grid.capturedTrailOwners.has(2)).toBe(true);
  });

  it('does not capture open cells connected to the edge', () => {
    const grid = new Grid(5, 5);
    grid.setOwner(2, 2, 1);

    captureArea(grid, 1, []);

    expect(grid.ownerAt(0, 0)).toBe(0);
    expect(grid.ownerAt(4, 4)).toBe(0);
  });
});


describe('map catalog', () => {
  it('replaces clover with a dedicated Australia map', () => {
    expect(MAPS.some(map => map.id === 'clover')).toBe(false);
    expect(MAPS.some(map => map.id === 'australia')).toBe(true);
    const mask = createMapMask(40, 30, 'australia');
    expect(mask.some(Boolean)).toBe(true);
    expect(mask.every(value => value === 0 || value === 1)).toBe(true);
  });

  it('falls back to the circle for a saved unknown map id', () => {
    expect(Array.from(createMapMask(12, 12, 'clover'))).toEqual(Array.from(createMapMask(12, 12, 'circle')));
  });
});
