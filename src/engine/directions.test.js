import { describe, expect, it } from 'vitest';
import { isReverseDirection } from './directions.js';

describe('isReverseDirection', () => {
  it('rejects a direct 180-degree reversal', () => {
    expect(isReverseDirection('up', 'down')).toBe(true);
    expect(isReverseDirection('left', 'right')).toBe(true);
  });

  it('allows turns that are not a direct reversal', () => {
    expect(isReverseDirection('up', 'left')).toBe(false);
    expect(isReverseDirection('right', 'right')).toBe(false);
  });

  it('returns false for unknown directions', () => {
    expect(isReverseDirection('idle', 'up')).toBe(false);
  });
});
