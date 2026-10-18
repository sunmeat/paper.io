import { describe, expect, it } from 'vitest';
import { Grid } from '../Grid.js';
import { mulberry32 } from '../random.js';
import { BasicBot } from './BasicBot.js';

describe('BasicBot', () => {
  it('returns one cardinal direction and never reverses immediately', () => {
    const grid = new Grid(12, 12);
    const bot = new BasicBot({ random: mulberry32(123), difficulty: 'easy' });
    const player = { id: 2, x: 6, y: 6, dx: 1, dy: 0, trailCells: [], homeX: 6, homeY: 6 };
    const direction = bot.nextDirection(player, { grid, players: [player] });
    expect([[0, -1], [1, 0], [0, 1], [-1, 0]]).toContainEqual(direction);
    expect(direction).not.toEqual([-1, 0]);
  });

  it('changes behavior parameters, not movement privileges, by difficulty', () => {
    const easy = new BasicBot({ random: mulberry32(7), difficulty: 'easy' });
    const hard = new BasicBot({ random: mulberry32(7), difficulty: 'hard' });
    expect(hard.params.vision).toBeGreaterThan(easy.params.vision);
    expect(hard.params.reactionTicks).toBeLessThan(easy.params.reactionTicks);
    expect(hard.params.expedition).toBeGreaterThan(easy.params.expedition);
  });
});
