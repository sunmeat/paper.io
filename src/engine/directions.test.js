import { describe, expect, it } from 'vitest';
import { isReverseDirection } from './directions.js';

describe('isReverseDirection', () => {
  it('rejects a direct 180-degree reversal', () => {
    expect(isReverseDirection([0, -1], [0, 1])).toBe(true);
    expect(isReverseDirection([-1, 0], [1, 0])).toBe(true);
  });

  it('allows turns that are not a direct reversal', () => {
    expect(isReverseDirection([0, -1], [-1, 0])).toBe(false);
    expect(isReverseDirection([1, 0], [1, 0])).toBe(false);
  });
});
