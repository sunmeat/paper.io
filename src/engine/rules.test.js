import { describe, expect, it } from 'vitest';
import { Grid } from './Grid.js';
import { captureArea } from './fill.js';
import { resolveHeadCollision, resolveTrailCrossing } from './rules.js';
import { Simulation } from './Simulation.js';

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



describe('pre-seeded match start', () => {
  it('warms up the bots before creating the human player', () => {
    const simulation = new Simulation({ config: { botCount: 6 } });

    expect(simulation.tick).toBe(280);
    expect(simulation.player).not.toBeNull();
    expect(simulation.bots).toHaveLength(6);
    for (const bot of simulation.bots) {
      expect(bot.startWidth).toBeGreaterThanOrEqual(4);
      expect(bot.startWidth).toBeLessThanOrEqual(12);
      expect(bot.startHeight).toBeGreaterThanOrEqual(4);
      expect(bot.startHeight).toBeLessThanOrEqual(12);
      expect(bot.name).toBeTruthy();
    }
  });

  it('keeps the initial player spawn away from the warmed-up bot territories', () => {
    const simulation = new Simulation({ config: { botCount: 6 } });
    const liveBots = simulation.bots.filter(bot => bot.alive);
    expect(liveBots.length).toBeGreaterThan(0);

    for (const bot of liveBots) {
      const distance = Math.hypot(bot.x - simulation.player.x, bot.y - simulation.player.y);
      expect(distance - Math.max(bot.startWidth, bot.startHeight) / 2).toBeGreaterThanOrEqual(16);
    }
  });
});


describe('leader selection', () => {
  it('keeps the current leader until a rival leads by at least 0.5% of the arena', () => {
    const simulation = new Simulation({ config: { worldWidth: 80, worldHeight: 60, botCount: 2 } });
    for (let index = 0; index < simulation.grid.owners.length; index++) {
      if (simulation.grid.owners[index]) simulation.grid.setOwnerAt(index, 0);
    }
    const cells = [];
    for (let index = 0; index < simulation.grid.walkable.length; index++) {
      if (simulation.grid.walkable[index]) cells.push(index);
    }
    for (const index of cells.slice(0, 100)) simulation.grid.setOwnerAt(index, 1);
    for (const index of cells.slice(100, 199)) simulation.grid.setOwnerAt(index, 2);

    expect(simulation.getStats().leaderId).toBe(1);
    const margin = Math.ceil(simulation.grid.walkableCount * 0.005);
    for (const index of cells.slice(199, 199 + margin)) simulation.grid.setOwnerAt(index, 2);
    expect(simulation.getStats().leaderId).toBe(1);

    simulation.grid.setOwnerAt(cells[199 + margin], 2);
    expect(simulation.getStats().leaderId).toBe(2);
  });
});

describe('territory transfer on direct trail kills', () => {
  function makeVictimTerritory(simulation, victim, count = 2) {
    const cells = [];
    for (let index = 0; index < simulation.grid.walkable.length && cells.length < count; index++) {
      if (simulation.grid.walkable[index] && simulation.grid.owners[index] === 0) cells.push(index);
    }
    expect(cells).toHaveLength(count);
    for (const index of cells) simulation.grid.setOwnerAt(index, victim.id);
    return cells;
  }

  it('transfers all territory to the killer when explicitly enabled', () => {
    const simulation = new Simulation({ config: { botCount: 0 } });
    const killer = simulation.player;
    const victim = simulation.createPlayer(2, 20, 20, 1, 0, false);
    const cells = makeVictimTerritory(simulation, victim);

    simulation.eliminatePlayer(victim, killer, { transferTerritory: true });

    expect(simulation.grid.territoryCount(victim.id)).toBe(0);
    for (const index of cells) expect(simulation.grid.owners[index]).toBe(killer.id);
  });

  it('does not transfer territory for other elimination causes', () => {
    const simulation = new Simulation({ config: { botCount: 0 } });
    const killer = simulation.player;
    const victim = simulation.createPlayer(2, 20, 20, 1, 0, false);
    const cells = makeVictimTerritory(simulation, victim);
    const killerTerritoryBefore = simulation.grid.territoryCount(killer.id);

    simulation.eliminatePlayer(victim, killer);

    expect(simulation.grid.territoryCount(victim.id)).toBe(0);
    for (const index of cells) expect(simulation.grid.owners[index]).toBe(0);
    expect(simulation.grid.territoryCount(killer.id)).toBe(killerTerritoryBefore);
  });
});
