import { GAME_CONFIG } from '../src/engine/config.js';
import { Simulation } from '../src/engine/Simulation.js';
import { BOT_PERSONALITIES } from '../src/engine/bots/difficulty.js';

const gameCount = Math.max(1, Number(process.argv[2]) || 200);
const maxTicks = Math.max(500, Number(process.argv[3]) || 3000);
const botCount = GAME_CONFIG.botCount;

function simulate(seed) {
  const simulation = new Simulation({ seed, humanPlayer: false });
  for (let tick = 0; tick < maxTicks; tick++) simulation.step();
  const players = [...simulation.players.values()];
  const ranked = [...players].sort((a, b) =>
    simulation.grid.territoryCount(b.id) - simulation.grid.territoryCount(a.id) || a.id - b.id
  );
  const playerKills = simulation.player?.kills || 0;
  const botKills = players.filter(player => !player.human).reduce((sum, player) => sum + (player.kills || 0), 0);
  const totalLifeTicks = players.reduce((sum, player) => sum + (player.totalLifeTicks || 0) + (player.currentLifeTicks || 0), 0);
  const completedLives = players.reduce((sum, player) => sum + (player.livesCompleted || 0) + (player.alive ? 1 : 0), 0);
  const personalityWins = Object.fromEntries(Object.keys(BOT_PERSONALITIES).map(key => [key, 0]));
  if (ranked[0]?.personality) personalityWins[ranked[0].personality]++;
  return {
    leader: ranked[0],
    survivors: players.filter(player => player.alive).length,
    deaths: players.reduce((sum, player) => sum + player.deaths, 0),
    lifetime: players.reduce((sum, player) => sum + player.lifetime, 0) / players.length,
    playerKills,
    botKills,
    averageLifetime: totalLifeTicks / Math.max(1, completedLives),
    personalityWins
  };
}

const wins = new Map();
const difficultyWins = new Map();
const personalityWins = Object.fromEntries(Object.keys(BOT_PERSONALITIES).map(key => [key, 0]));
let lifetimeTotal = 0;
let survivorsTotal = 0;
let deathsTotal = 0;
let playerKillsTotal = 0;
let botKillsTotal = 0;
let averageLifetimeTotal = 0;

for (let game = 0; game < gameCount; game++) {
  const result = simulate(0x51f15e + game * 7919);
  lifetimeTotal += result.lifetime;
  survivorsTotal += result.survivors;
  deathsTotal += result.deaths;
  playerKillsTotal += result.playerKills;
  botKillsTotal += result.botKills;
  averageLifetimeTotal += result.averageLifetime;
  wins.set(result.leader.id, (wins.get(result.leader.id) || 0) + 1);
  const difficulty = result.leader.strategy?.difficulty ?? 'observer';
  difficultyWins.set(difficulty, (difficultyWins.get(difficulty) || 0) + 1);
  for (const [personality, count] of Object.entries(result.personalityWins)) personalityWins[personality] += count;
}

const winValues = [...wins.values()];
console.log(`Headless simulation: ${gameCount} matches, ${botCount} bots, ${maxTicks} tick limit`);
console.log(`Average life duration: ${(averageLifetimeTotal / gameCount).toFixed(1)} ticks per life`);
console.log(`Average bots alive at stop: ${(survivorsTotal / gameCount).toFixed(2)} / ${botCount}`);
console.log(`Average eliminations per match: ${(deathsTotal / gameCount).toFixed(1)}`);
console.log(`Average human-player kills per match: ${(playerKillsTotal / gameCount).toFixed(1)}`);
console.log(`Average bot kills per match: ${(botKillsTotal / gameCount).toFixed(1)}`);
console.log(`Different territory leaders: ${wins.size} / ${botCount}`);
console.log(`Largest seat lead share: ${(Math.max(...winValues) / gameCount * 100).toFixed(1)}%`);
console.log('Territory leaders by seat:', Object.fromEntries([...wins.entries()].sort((a, b) => a[0] - b[0])));
console.log('Territory leaders by difficulty:', Object.fromEntries(difficultyWins));
console.log('Win share by personality:', Object.fromEntries(Object.entries(personalityWins).map(([key, value]) => [key, `${(value / gameCount * 100).toFixed(1)}%`])));
