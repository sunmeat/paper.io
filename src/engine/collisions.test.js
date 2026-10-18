import { describe, expect, it } from 'vitest';
import { findTrailCollision } from './collisions.js';

describe('findTrailCollision', () => {
  it('detects a rival trail on the exact target cell', () => {
    const players = [
      { id: 1, alive: true, trailCells: [10, 11] },
      { id: 2, alive: true, trailCells: [20, 21] }
    ];

    expect(findTrailCollision(20, 1, players)?.id).toBe(2);
  });

  it('does not treat two adjacent trails as a collision', () => {
    const players = [
      { id: 1, alive: true, trailCells: [10] },
      { id: 2, alive: true, trailCells: [11] }
    ];

    expect(findTrailCollision(10, 1, players)).toBeNull();
  });

  it('ignores dead rivals and the moving player own trail', () => {
    const players = [
      { id: 1, alive: true, trailCells: [10] },
      { id: 2, alive: false, trailCells: [10] }
    ];

    expect(findTrailCollision(10, 1, players)).toBeNull();
  });
});
