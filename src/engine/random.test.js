import { describe, expect, it } from 'vitest';
import { mulberry32 } from './random.js';

describe('mulberry32', () => {
  it('produces the same sequence from the same seed', () => {
    const first = mulberry32(1234);
    const second = mulberry32(1234);

    expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second));
  });

  it('produces values in the [0, 1) range', () => {
    const random = mulberry32(9876);
    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
