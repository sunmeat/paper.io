import { Grid } from '../src/engine/Grid.js';
import { captureArea } from '../src/engine/fill.js';
import { mulberry32 } from '../src/engine/random.js';
import { BasicBot } from '../src/engine/bots/BasicBot.js';
import { GAME_CONFIG } from '../src/engine/config.js';

const gameCount = Math.max(1, Number(process.argv[2]) || 200);
const maxTicks = Math.max(500, Number(process.argv[3]) || 3000);
const botCount = GAME_CONFIG.botCount;
const width = GAME_CONFIG.worldWidth;
const height = GAME_CONFIG.worldHeight;
const ringRadius = Math.min(width, height) * 0.38;

function simulate(seed) {
  const random = mulberry32(seed);
  const grid = new Grid(width, height);
  const players = Array.from({ length: botCount }, (_, i) => {
    const angle = 2 * Math.PI * i / botCount;
    const x = Math.round(width / 2 + Math.cos(angle) * ringRadius);
    const y = Math.round(height / 2 + Math.sin(angle) * ringRadius);
    const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
    const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
    const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
    return {
      id: i + 1, x, y, dx: dx || (dy ? 0 : 1), dy, alive: true,
      trailCells: [], lifetime: 0, deaths: 0, respawnAt: 0,
      strategy: new BasicBot({ random, difficulty: ['easy', 'normal', 'hard'][i % 3] })
    };
  });
  const paintHome = player => {
    for (let y = player.y - 1; y <= player.y + 1; y++) {
      for (let x = player.x - 1; x <= player.x + 1; x++) {
        if (grid.inside(x, y) && !grid.ownerAt(x, y) && !grid.trailAt(x, y)) grid.setOwner(x, y, player.id);
      }
    }
  };
  for (const player of players) paintHome(player);

  const eliminate = (player, tick) => {
    if (!player.alive) return;
    player.alive = false;
    player.deaths++;
    player.respawnAt = tick + 12;
    grid.clearTerritory(player.id);
    for (const index of player.trailCells) grid.trail[index] = 0;
    player.trailCells = [];
  };
  const respawn = player => {
    const start = Math.floor(random() * grid.owners.length);
    for (let offset = 0; offset < grid.owners.length; offset++) {
      const index = (start + offset) % grid.owners.length;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) continue;
      let free = true;
      for (let yy = y - 1; yy <= y + 1 && free; yy++) {
        for (let xx = x - 1; xx <= x + 1; xx++) {
          const cell = grid.index(xx, yy);
          if (grid.owners[cell] || grid.trail[cell]) { free = false; break; }
        }
      }
      if (!free) continue;
      player.x = x; player.y = y;
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const direction = dirs[Math.floor(random() * dirs.length)];
      player.dx = direction[0]; player.dy = direction[1];
      player.alive = true;
      player.respawnAt = 0;
      player.trailCells = [];
      paintHome(player);
      return true;
    }
    return false;
  };

  for (let tick = 0; tick < maxTicks; tick++) {
    for (const player of players) {
      if (!player.alive) {
        if (tick >= player.respawnAt) respawn(player);
        continue;
      }
      player.lifetime++;
      const [dx, dy] = player.strategy.nextDirection(player, { grid, players });
      player.dx = dx;
      player.dy = dy;
      let x = player.x + dx;
      let y = player.y + dy;
      if (!grid.inside(x, y)) {
        player.dx *= -1; player.dy *= -1;
        x = player.x + player.dx; y = player.y + player.dy;
        if (!grid.inside(x, y)) continue;
      }
      const index = grid.index(x, y);
      const trailOwner = grid.trail[index];
      if (trailOwner) {
        if (trailOwner !== player.id) {
          const owner = players.find(candidate => candidate.id === trailOwner);
          if (owner) eliminate(owner, tick);
        } else eliminate(player, tick);
        continue;
      }
      const rival = players.find(candidate => candidate.alive && candidate.id !== player.id && candidate.x === x && candidate.y === y);
      if (rival) {
        const ownLength = player.trailCells.length;
        const rivalLength = rival.trailCells.length;
        if (ownLength >= rivalLength) eliminate(player, tick);
        if (rivalLength >= ownLength) eliminate(rival, tick);
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
  return {
    leader: ranked[0],
    survivors: players.filter(player => player.alive).length,
    deaths: players.reduce((sum, player) => sum + player.deaths, 0),
    lifetime: players.reduce((sum, player) => sum + player.lifetime, 0) / players.length
  };
}

const wins = new Map();
const difficultyWins = new Map();
let lifetimeTotal = 0;
let survivorsTotal = 0;
let deathsTotal = 0;
for (let game = 0; game < gameCount; game++) {
  const result = simulate(0x51f15e + game * 7919);
  lifetimeTotal += result.lifetime;
  survivorsTotal += result.survivors;
  deathsTotal += result.deaths;
  wins.set(result.leader.id, (wins.get(result.leader.id) || 0) + 1);
  const difficulty = result.leader.strategy.difficulty;
  difficultyWins.set(difficulty, (difficultyWins.get(difficulty) || 0) + 1);
}
const winValues = [...wins.values()];
console.log(`Headless simulation: ${gameCount} matches, ${botCount} bots, ${maxTicks} tick limit`);
console.log(`Average active lifetime: ${(lifetimeTotal / gameCount / botCount).toFixed(1)} ticks per bot`);
console.log(`Average bots alive at stop: ${(survivorsTotal / gameCount).toFixed(2)} / ${botCount}`);
console.log(`Average eliminations per match: ${(deathsTotal / gameCount).toFixed(1)}`);
console.log(`Different territory leaders: ${wins.size} / ${botCount}`);
console.log(`Largest seat lead share: ${(Math.max(...winValues) / gameCount * 100).toFixed(1)}%`);
console.log('Territory leaders by seat:', Object.fromEntries([...wins.entries()].sort((a, b) => a[0] - b[0])));
console.log('Territory leaders by difficulty:', Object.fromEntries(difficultyWins));
