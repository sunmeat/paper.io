import { Grid } from '../src/engine/Grid.js';
import { captureArea } from '../src/engine/fill.js';
import { mulberry32 } from '../src/engine/random.js';
import { BasicBot } from '../src/engine/bots/BasicBot.js';

const gameCount = Math.max(1, Number(process.argv[2]) || 200);
const maxTicks = Math.max(500, Number(process.argv[3]) || 3000);
const botCount = 10;
const width = 72;
const height = 48;

function simulate(seed) {
  const random = mulberry32(seed);
  const grid = new Grid(width, height);
  const players = Array.from({ length: botCount }, (_, i) => {
    const angle = 2 * Math.PI * i / botCount;
    const x = Math.round(width / 2 + Math.cos(angle) * width * 0.34);
    const y = Math.round(height / 2 + Math.sin(angle) * height * 0.34);
    const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
    const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
    const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
    return {
      id: i + 1, x, y, dx: dx || (dy ? 0 : 1), dy, alive: true,
      trailCells: [], lifetime: 0,
      strategy: new BasicBot({ random, difficulty: ['easy', 'normal', 'hard'][i % 3] })
    };
  });
  for (const player of players) {
    for (let y = player.y - 1; y <= player.y + 1; y++) {
      for (let x = player.x - 1; x <= player.x + 1; x++) {
        if (grid.inside(x, y) && !grid.ownerAt(x, y)) grid.setOwner(x, y, player.id);
      }
    }
  }
  const eliminate = player => {
    if (!player.alive) return;
    player.alive = false;
    grid.clearTerritory(player.id);
    for (const index of player.trailCells) grid.trail[index] = 0;
    player.trailCells = [];
  };

  let ticks = 0;
  for (; ticks < maxTicks; ticks++) {
    const active = players.filter(player => player.alive);
    if (active.length <= 1) break;
    for (const player of active) {
      if (!player.alive) continue;
      player.lifetime++;
      const [dx, dy] = player.strategy.nextDirection(player, { grid, players });
      player.dx = dx;
      player.dy = dy;
      const x = player.x + dx;
      const y = player.y + dy;
      if (!grid.inside(x, y)) { eliminate(player); continue; }
      const index = grid.index(x, y);
      const trailOwner = grid.trail[index];
      if (trailOwner) {
        if (trailOwner !== player.id) {
          const owner = players.find(candidate => candidate.id === trailOwner);
          if (owner) eliminate(owner);
        } else eliminate(player);
        continue;
      }
      const rival = players.find(candidate => candidate.alive && candidate.id !== player.id && candidate.x === x && candidate.y === y);
      if (rival) {
        const ownLength = player.trailCells.length;
        const rivalLength = rival.trailCells.length;
        if (ownLength >= rivalLength) eliminate(player);
        if (rivalLength >= ownLength) eliminate(rival);
        if (!player.alive) continue;
      }
      player.x = x;
      player.y = y;
      if (grid.ownerAt(x, y) === player.id) {
        if (player.trailCells.length) {
          captureArea(grid, player.id, player.trailCells);
          player.trailCells = [];
        }
      } else {
        grid.setTrail(x, y, player.id);
        player.trailCells.push(index);
      }
    }
  }
  const ranked = [...players].sort((a, b) => grid.territoryCount(b.id) - grid.territoryCount(a.id));
  return { winner: ranked[0], alive: players.filter(player => player.alive).length, lifetime: players.reduce((sum, player) => sum + player.lifetime, 0) / players.length, ticks };
}

const wins = new Map();
const difficultyWins = new Map();
let lifetimeTotal = 0;
let survivorsTotal = 0;
let ticksTotal = 0;
for (let game = 0; game < gameCount; game++) {
  const result = simulate(0x51f15e + game * 7919);
  lifetimeTotal += result.lifetime;
  survivorsTotal += result.alive;
  ticksTotal += result.ticks;
  wins.set(result.winner.id, (wins.get(result.winner.id) || 0) + 1);
  const difficulty = result.winner.strategy.difficulty;
  difficultyWins.set(difficulty, (difficultyWins.get(difficulty) || 0) + 1);
}
const winValues = [...wins.values()];
console.log(`Headless simulation: ${gameCount} matches, ${botCount} bots, ${maxTicks} tick limit`);
console.log(`Mean lifetime: ${(lifetimeTotal / gameCount).toFixed(1)} ticks per bot`);
console.log(`Mean survivors at stop: ${(survivorsTotal / gameCount).toFixed(2)} / ${botCount}`);
console.log(`Distinct winning seats: ${wins.size} / ${botCount}`);
console.log(`Highest seat win share: ${(Math.max(...winValues) / gameCount * 100).toFixed(1)}%`);
console.log('Wins by seat:', Object.fromEntries([...wins.entries()].sort((a, b) => a[0] - b[0])));
console.log('Wins by difficulty:', Object.fromEntries(difficultyWins));
