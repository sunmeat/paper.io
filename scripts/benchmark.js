import { performance } from 'node:perf_hooks';
import { Simulation } from '../src/engine/Simulation.js';
import { GAME_CONFIG } from '../src/engine/config.js';

const config = { ...GAME_CONFIG, worldWidth: 150, worldHeight: 150, botCount: 10 };
const simulation = new Simulation({ config, seed: 0x13b10c });
const warmupSteps = 300;
const measuredSteps = 3000;

for (let i = 0; i < warmupSteps; i++) simulation.step();
const started = performance.now();
for (let i = 0; i < measuredSteps && !simulation.over; i++) simulation.step();
const elapsedMs = performance.now() - started;
const completedSteps = Math.min(measuredSteps, simulation.tick - warmupSteps);
const stepsPerSecond = Math.round(completedSteps / (elapsedMs / 1000));

console.log('sunmeat.io simulation benchmark');
console.log(`World: ${config.worldWidth}x${config.worldHeight} | bots: ${config.botCount}`);
console.log(`Measured steps: ${completedSteps} | elapsed: ${Math.round(elapsedMs)} ms`);
console.log(`Simulation throughput: ${stepsPerSecond} steps/s`);
console.log('Note: this is a headless simulation benchmark, not a browser FPS measurement.');
console.log('For real render FPS, open the game with ?benchmark=1; samples appear in the browser console.');
