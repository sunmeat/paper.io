import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game.js';
import { GAME_CONFIG } from './config.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fixed world and viewport resizing', () => {
  it('uses the configured world dimensions instead of viewport dimensions', () => {
    expect(GAME_CONFIG.worldWidth).toBe(90);
    expect(GAME_CONFIG.worldHeight).toBe(90);
  });

  it('does not mutate game state when the canvas viewport changes size', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });

    const grid = { owners: new Uint8Array([1, 0, 2]), trail: new Uint8Array([0, 1, 0]) };
    const player = { id: 1, x: 16, y: 45, dx: 1, dy: 0, trailCells: [1], alive: true };
    const bot = { id: 2, x: 75, y: 45, dx: -1, dy: 0, trailCells: [], alive: true };
    const stateBefore = structuredClone({ grid, player, bots: [bot] });
    const canvas = {
      width: 0,
      height: 0,
      getBoundingClientRect: () => ({ width: 1200, height: 700 })
    };
    const game = Object.create(Game.prototype);
    Object.assign(game, {
      running: true,
      canvas,
      ctx: { setTransform: vi.fn() },
      dpr: 1,
      terrainDirty: false,
      cellsWide: GAME_CONFIG.worldWidth,
      cellsHigh: GAME_CONFIG.worldHeight,
      grid,
      player,
      bots: [bot],
      draw: vi.fn()
    });

    game.resize();

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1400);
    expect(game.cellsWide).toBe(90);
    expect(game.cellsHigh).toBe(90);
    expect(game.grid).toBe(grid);
    expect(game.player).toBe(player);
    expect(game.bots[0]).toBe(bot);
    expect({ grid, player, bots: [bot] }).toEqual(stateBefore);
    expect(game.draw).toHaveBeenCalledOnce();
  });
});
