import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game.js';
import { Simulation } from './Simulation.js';
import { GAME_CONFIG } from './config.js';
import { createMapMask, MAPS } from './maps.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function deterministicSnapshot(seed) {
  const config = { ...GAME_CONFIG, worldWidth: 48, worldHeight: 48, botCount: 5 };
  const simulation = new Simulation({ seed, config, humanPlayer: false });
  for (let tick = 0; tick < 700; tick++) simulation.step();
  return {
    tick: simulation.tick,
    players: [...simulation.players.values()].map(({ id, x, y, dx, dy, alive, deaths, lifetime, trailCells }) => ({
      id, x, y, dx, dy, alive, deaths, lifetime, trailCells: [...trailCells]
    })),
    owners: Array.from(simulation.grid.owners),
    trail: Array.from(simulation.grid.trail)
  };
}

describe('Simulation', () => {
  it('provides ten built-in arena shapes', () => {
    expect(MAPS).toHaveLength(10);
    for (const map of MAPS) {
      const mask = createMapMask(90, 90, map.id);
      expect(mask.length).toBe(8100);
      expect(mask.reduce((sum, value) => sum + value, 0)).toBeGreaterThan(100);
    }
  });

  it('spawns every player and starting territory inside the selected mask', () => {
    const simulation = new Simulation({ mapId: 'star' });
    for (const player of simulation.players.values()) {
      expect(simulation.grid.inside(player.x, player.y)).toBe(true);
      for (const index of player.trailCells) expect(simulation.grid.walkable[index]).toBe(1);
    }
    for (let index = 0; index < simulation.grid.owners.length; index++) {
      if (simulation.grid.owners[index]) expect(simulation.grid.walkable[index]).toBe(1);
    }
  });

  it('does not eliminate a player when they cross their own trail', () => {
    const config = { ...GAME_CONFIG, worldWidth: 30, worldHeight: 30, botCount: 0 };
    const simulation = new Simulation({ config });
    const player = simulation.player;
    player.x = 12;
    player.y = 15;
    player.dx = 1;
    player.dy = 0;
    simulation.grid.setTrail(13, 15, player.id);
    player.trailCells = [simulation.grid.index(13, 15)];

    simulation.movePlayer(player);

    expect(player.alive).toBe(true);
    expect(player.x).toBe(13);
    expect(player.y).toBe(15);
    expect(player.trailCells).toEqual([simulation.grid.index(13, 15)]);
    expect(simulation.over).toBe(false);
  });

  it('uses the configured fixed world dimensions', () => {
    expect(GAME_CONFIG.worldWidth).toBe(90);
    expect(GAME_CONFIG.worldHeight).toBe(90);
  });

  it('reports territory as a percentage of world cells', () => {
    const simulation = new Simulation({ config: { ...GAME_CONFIG, botCount: 0 } });
    simulation.grid.territoryCounts[1] = 81;
    expect(simulation.getStats().territory).toBe(1);
  });

  it('produces the same complete match state for the same seed', () => {
    expect(deterministicSnapshot(0x12345678)).toEqual(deterministicSnapshot(0x12345678));
  });

  it('stores every player in a map keyed by ID', () => {
    const simulation = new Simulation();
    expect(simulation.players).toBeInstanceOf(Map);
    expect(simulation.players.get(simulation.player.id)).toBe(simulation.player);
    for (const bot of simulation.bots) expect(simulation.players.get(bot.id)).toBe(bot);
  });

  it('publishes named gameplay events', () => {
    const simulation = new Simulation();
    const listener = vi.fn();
    const unsubscribe = simulation.events.on('powerup', listener);
    expect(simulation.collectPowerup(1, 'shield')).toBe(true);
    expect(listener).toHaveBeenCalledWith({ playerId: 1, powerup: 'shield' });
    unsubscribe();
    expect(simulation.collectPowerup(1, 'shield')).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('fixed world and viewport resizing', () => {
  it('does not mutate simulation state when the canvas viewport changes size', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const simulation = new Simulation();
    const stateBefore = {
      owners: Array.from(simulation.grid.owners),
      trail: Array.from(simulation.grid.trail),
      player: structuredClone(simulation.player),
      bots: simulation.bots.map(({ id, x, y, dx, dy, alive, trailCells }) => ({ id, x, y, dx, dy, alive, trailCells: [...trailCells] }))
    };
    const canvas = {
      width: 0,
      height: 0,
      getBoundingClientRect: () => ({ width: 1200, height: 700 })
    };
    const game = Object.create(Game.prototype);
    Object.assign(game, {
      running: true,
      simulation,
      canvas,
      ctx: { setTransform: vi.fn() },
      dpr: 1,
      terrainDirty: false,
      draw: vi.fn()
    });

    game.resize();

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1400);
    expect(game.cellsWide).toBe(90);
    expect(game.cellsHigh).toBe(90);
    expect(simulation.grid.owners).toEqual(Uint8Array.from(stateBefore.owners));
    expect(simulation.grid.trail).toEqual(Uint8Array.from(stateBefore.trail));
    expect(simulation.player).toEqual(stateBefore.player);
    expect(simulation.bots.map(({ id, x, y, dx, dy, alive, trailCells }) => ({ id, x, y, dx, dy, alive, trailCells: [...trailCells] }))).toEqual(stateBefore.bots);
    expect(game.draw).toHaveBeenCalledOnce();
  });
});
