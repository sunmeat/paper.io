import { describe, expect, it } from 'vitest';
import { evaluateRoundOutcome } from './modes.js';
import { Simulation } from './Simulation.js';

describe('round victory conditions', () => {
  it('wins classic mode at 90 percent territory', () => {
    expect(evaluateRoundOutcome({ playerTerritory: 90, topTerritory: 50, aliveBots: 4 })).toBe('victory');
  });

  it('wins classic mode when the player is the only living competitor', () => {
    expect(evaluateRoundOutcome({ playerTerritory: 12, topTerritory: 0, aliveBots: 0 })).toBe('victory');
  });

  it('does not finish classic mode below the target while rivals remain', () => {
    expect(evaluateRoundOutcome({ playerTerritory: 89.999, topTerritory: 35, aliveBots: 2 })).toBeNull();
  });

  it('decides sprint by territory when the timer expires', () => {
    expect(evaluateRoundOutcome({ modeId: 'sprint', elapsedMs: 180000, playerTerritory: 30, topTerritory: 29 })).toBe('victory');
    expect(evaluateRoundOutcome({ modeId: 'sprint', elapsedMs: 180000, playerTerritory: 28, topTerritory: 29 })).toBe('defeat');
  });

  it('does not end sprint before its time limit', () => {
    expect(evaluateRoundOutcome({ modeId: 'sprint', elapsedMs: 179999, playerTerritory: 99, topTerritory: 0 })).toBeNull();
  });

  it('always marks a dead player as defeated', () => {
    expect(evaluateRoundOutcome({ playerAlive: false, playerTerritory: 100 })).toBe('defeat');
  });
});

describe('game simulation victory integration', () => {
  const createSimulation = modeId => new Simulation({
    seed: 7,
    modeId,
    config: {
      worldWidth: 30,
      worldHeight: 30,
      botCount: 1,
      playerStartWidth: 5,
      playerStartHeight: 4,
      botStartWidth: 4,
      botStartHeight: 3
    }
  });

  it('finishes the classic simulation when the player captures the whole map', () => {
    const simulation = createSimulation('classic');
    for (let i = 0; i < simulation.grid.owners.length; i++) {
      if (simulation.grid.walkable[i]) simulation.grid.setOwnerAt(i, 1);
    }
    simulation.checkRoundOutcome();
    expect(simulation.over).toBe(true);
    expect(simulation.outcome).toBe('victory');
    expect(simulation.secretConquered).toBe(true);
  });

  it('finishes sprint simulation at the time limit and records the winner', () => {
    const simulation = createSimulation('sprint');
    simulation.elapsedMs = 180000;
    simulation.checkRoundOutcome();
    expect(simulation.over).toBe(true);
    expect(['victory', 'defeat']).toContain(simulation.outcome);
  });
});
