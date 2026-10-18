import { describe, expect, it } from 'vitest';
import { Grid } from './Grid.js';
import { captureArea } from './fill.js';
import { resolveHeadCollision, resolveTrailCrossing } from './rules.js';

describe('territory ownership and captures', () => {
  it('updates territory counts incrementally when ownership changes', () => {
    const grid = new Grid(3, 3);
    grid.setOwner(1, 1, 1);
    grid.setOwner(1, 1, 2);
    grid.setOwner(2, 1, 2);

    expect(grid.territoryCount(1)).toBe(0);
    expect(grid.territoryCount(2)).toBe(2);
  });

  it('captures a closed area including rival territory and updates both scores', () => {
    const grid = new Grid(7, 7);
    for (let x = 1; x <= 5; x++) {
      grid.setOwner(x, 1, 1);
      grid.setOwner(x, 5, 1);
    }
    for (let y = 2; y <= 4; y++) {
      grid.setOwner(1, y, 1);
      grid.setOwner(5, y, 1);
    }
    grid.setOwner(3, 3, 2);

    const captured = captureArea(grid, 1, []);

    expect(grid.ownerAt(3, 3)).toBe(1);
    expect(grid.territoryCount(2)).toBe(0);
    expect(captured).toBe(9);
    expect(grid.territoryCount(1)).toBe(25);
  });

  it('detects loss of all territory without a full-board recount', () => {
    const grid = new Grid(2, 2);
    grid.setOwner(0, 0, 1);
    grid.setOwner(0, 0, 2);

    expect(grid.territoryCount(1)).toBe(0);
  });
});

describe('collision rules', () => {
  it('kills the owner when a rival crosses their trail', () => {
    expect(resolveTrailCrossing(1, 2)).toBe(2);
  });

  it('kills the player with the longer exposed trail in a head collision', () => {
    expect(resolveHeadCollision(
      { id: 1, trailCells: [1, 2, 3, 4] },
      { id: 2, trailCells: [5, 6] }
    )).toEqual([1]);
  });

  it('kills both players when head collision trail lengths are equal', () => {
    expect(resolveHeadCollision(
      { id: 1, trailCells: [1, 2] },
      { id: 2, trailCells: [3, 4] }
    )).toEqual([1, 2]);
  });
});
