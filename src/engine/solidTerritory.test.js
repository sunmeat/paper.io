import { describe, expect, it } from 'vitest';
import { fillNarrowGaps } from './fill.js';
import { Grid } from './Grid.js';
import { GAME_CONFIG } from './config.js';
import { Simulation } from './Simulation.js';

const whole = grid => ({ minX: 0, maxX: grid.width - 1, minY: 0, maxY: grid.height - 1 });

function paint(grid, rows) {
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    if (cell === '.') return;
    if (cell === 't') grid.setTrail(x, y, 2);
    else grid.setOwner(x, y, Number(cell));
  }));
}

function render(grid) {
  const rows = [];
  for (let y = 0; y < grid.height; y++) {
    let row = '';
    for (let x = 0; x < grid.width; x++) row += grid.trailAt(x, y) ? 't' : grid.ownerAt(x, y) || '.';
    rows.push(row);
  }
  return rows;
}

describe('fillNarrowGaps', () => {
  it('closes a one-cell slit between two parts of the same territory', () => {
    const grid = new Grid(9, 5);
    paint(grid, ['111.111..', '111.111..', '111.111..', '111111...', '.........']);
    fillNarrowGaps(grid, whole(grid));
    expect(render(grid).slice(0, 4)).toEqual(['1111111..', '1111111..', '1111111..', '111111...']);
  });

  it('closes a two-cell wide slit but leaves a three-cell wide channel open', () => {
    const narrow = new Grid(9, 3);
    paint(narrow, ['11..111..', '11..111..', '111111...']);
    fillNarrowGaps(narrow, whole(narrow));
    expect(render(narrow)[0]).toBe('1111111..');

    const wide = new Grid(9, 3);
    paint(wide, ['11...111.', '11...111.', '111111111']);
    fillNarrowGaps(wide, whole(wide));
    expect(render(wide)[0]).toBe('11...111.');
  });

  it('never claims rival land, trails or cells between different owners', () => {
    const grid = new Grid(7, 3);
    paint(grid, ['11.22.t', '11.22.t', '1111111']);
    const before = render(grid);
    fillNarrowGaps(grid, whole(grid));
    // Column 2 sits between owner 1 and owner 2, the last column is a rival trail.
    expect(render(grid)[0]).toBe(before[0]);
  });

  it('reports how many cells were claimed and can be limited to one owner', () => {
    const grid = new Grid(9, 3);
    paint(grid, ['11.11.22.', '11.11.22.', '1111111..']);
    expect(fillNarrowGaps(grid, whole(grid), { owner: 2 })).toBe(0);
    expect(fillNarrowGaps(grid, whole(grid), { owner: 1 })).toBe(2);
  });
});

describe('simulation trails and territory', () => {
  it('keeps every trail gap-free and territory free of narrow slits', () => {
    const problems = [];
    for (const seed of [1000, 8919, 16838]) {
      const sim = new Simulation({ config: { ...GAME_CONFIG, botCount: 14 }, seed, humanPlayer: false });
      const { grid } = sim;
      const width = grid.width;
      for (let tick = 0; tick < 1200 && !sim.over; tick++) {
        sim.step();
        for (const player of sim.players.values()) {
          if (!player.alive || !player.trailCells.length) continue;
          const cells = player.trailCells;
          for (let i = 1; i < cells.length; i++) {
            const distance = Math.abs(cells[i] % width - cells[i - 1] % width) +
              Math.abs(Math.floor(cells[i] / width) - Math.floor(cells[i - 1] / width));
            if (distance !== 1) problems.push(`seed ${seed} tick ${sim.tick}: gap in trail of player ${player.id} at cell ${i}`);
          }
          if (cells[cells.length - 1] !== player.y * width + player.x) {
            problems.push(`seed ${seed} tick ${sim.tick}: trail of player ${player.id} does not end at its head`);
          }
        }
        if (tick % 20 !== 0) continue;
        for (let y = 1; y < grid.height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const index = y * width + x;
            if (!grid.walkable[index] || grid.owners[index] || grid.trail[index]) continue;
            const left = grid.owners[index - 1], right = grid.owners[index + 1];
            const up = grid.owners[index - width], down = grid.owners[index + width];
            if ((left && left === right) || (up && up === down)) problems.push(`seed ${seed} tick ${sim.tick}: slit at ${x},${y}`);
          }
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});
