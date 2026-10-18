import { captureArea } from './fill.js';
import { bindInput } from './input.js';
import { Grid } from './Grid.js';
import { isReverseDirection } from './directions.js';
import { findTrailCollision } from './collisions.js';
import { GAME_CONFIG } from './config.js';
import { mulberry32 } from './random.js';

const COLORS = {
  1: '#9b7bff',
  2: '#ff6685',
  3: '#ffbd59',
  4: '#42d9c0',
  5: '#65a8ff',
  6: '#f58bdf'
};
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Canvas game engine. Simulation updates use a fixed timestep; rendering remains
 * tied to requestAnimationFrame and may run at any display refresh rate.
 */
export class Game {
  /**
   * @param {HTMLCanvasElement} canvas Rendering and touch-input surface.
   * @param {{onStats?:(snapshot:object)=>void,onGameOver?:(snapshot:object)=>void,onBotDown?:(id:number)=>void,seed?:number}} callbacks HUD callbacks and optional deterministic seed.
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.seed = callbacks.seed ?? GAME_CONFIG.seed;
    this.random = mulberry32(this.seed);
    this.running = true;
    this.paused = false;
    this.over = false;
    this.frame = 0;
    this.lastTime = 0;
    this.accumulator = 0;
    this.moveAccumulator = 0;
    this.lastStatsAt = 0;
    this.dpr = 1;
    this.cellsWide = 0;
    this.cellsHigh = 0;
    this.grid = null;
    this.player = null;
    this.bots = [];
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.unbindInput = bindInput(canvas, this);
    this.onVisibility = () => { this.lastTime = 0; };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.reset();
    this.frame = requestAnimationFrame(time => this.loop(time));
  }

  /** Resizes the drawing buffer and recreates the grid only when dimensions change. */
  resize() {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const width = Math.max(GAME_CONFIG.minColumns, Math.floor(rect.width / GAME_CONFIG.cellSize));
    const height = Math.max(GAME_CONFIG.minRows, Math.floor(rect.height / GAME_CONFIG.cellSize));
    if (width !== this.cellsWide || height !== this.cellsHigh) {
      this.cellsWide = width;
      this.cellsHigh = height;
      this.reset();
    }
    this.draw();
  }

  /** Starts a fresh deterministic round. */
  reset() {
    if (!this.cellsWide || !this.cellsHigh) return;
    this.random = mulberry32(this.seed);
    this.grid = new Grid(this.cellsWide, this.cellsHigh);
    const cx = Math.floor(this.cellsWide / 2);
    const cy = Math.floor(this.cellsHigh / 2);
    this.player = this.createPlayer(1, cx, cy, 1, 0, true);
    const botSpawns = [
      [Math.floor(this.cellsWide * .22), Math.floor(this.cellsHigh * .28), 1, 0],
      [Math.floor(this.cellsWide * .76), Math.floor(this.cellsHigh * .38), 0, 1],
      [Math.floor(this.cellsWide * .70), Math.floor(this.cellsHigh * .76), -1, 0],
      [Math.floor(this.cellsWide * .25), Math.floor(this.cellsHigh * .76), 0, -1],
      [Math.floor(this.cellsWide * .75), Math.floor(this.cellsHigh * .20), 0, 1]
    ];
    this.bots = botSpawns.slice(0, GAME_CONFIG.botCount).map((spawn, index) =>
      this.createPlayer(index + 2, spawn[0], spawn[1], spawn[2], spawn[3])
    );
    this.over = false;
    this.paused = false;
    this.accumulator = 0;
    this.moveAccumulator = 0;
    this.lastTime = 0;
    this.initializeTerritory(this.player, GAME_CONFIG.playerStartWidth, GAME_CONFIG.playerStartHeight);
    for (const bot of this.bots) {
      this.initializeTerritory(bot, GAME_CONFIG.botStartWidth, GAME_CONFIG.botStartHeight);
    }
    this.emitStats();
  }

  /**
   * @param {number} id Player identifier.
   * @param {number} x Starting column.
   * @param {number} y Starting row.
   * @param {number} dx Initial horizontal direction.
   * @param {number} dy Initial vertical direction.
   * @param {boolean} [human=false] Whether this is the human-controlled player.
   * @returns {object} Mutable player simulation state.
   */
  createPlayer(id, x, y, dx, dy, human = false) {
    return {
      id, x, y, dx, dy, next: null, trailCells: [], alive: true,
      human, turnTimer: 0, territory: 0
    };
  }

  /** Paints a player's initial rectangle. */
  initializeTerritory(player, width, height) {
    const left = player.x - Math.floor(width / 2);
    const top = player.y - Math.floor(height / 2);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (this.grid.inside(x, y)) this.grid.setOwner(x, y, player.id);
      }
    }
  }

  /** Queues one legal turn for the next simulation movement step. */
  queueDirection(dx, dy) {
    if (!this.running || this.paused || this.over) return;
    const current = this.player;
    if (!current?.alive) return;
    if (isReverseDirection([current.dx, current.dy], [dx, dy])) return;
    if (current.next && isReverseDirection(current.next, [dx, dy])) return;
    current.next = [dx, dy];
  }

  /** Pauses or resumes simulation without changing the render loop. */
  setPaused(paused) {
    this.paused = Boolean(paused);
    this.lastTime = 0;
    this.emitStats();
  }

  /** Restarts the round with the configured seed. */
  restart() {
    this.reset();
  }

  /** Fixed-step accumulator loop with a render on every animation frame. */
  loop(time) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = time;
    const delta = Math.min(time - this.lastTime, GAME_CONFIG.maxFrameDeltaMs);
    this.lastTime = time;
    if (!this.paused && !this.over) {
      this.accumulator += delta;
      while (this.accumulator >= GAME_CONFIG.fixedStepMs) {
        this.update(GAME_CONFIG.fixedStepMs);
        this.accumulator -= GAME_CONFIG.fixedStepMs;
        if (this.over) break;
      }
    }
    this.draw();
    if (time - this.lastStatsAt >= GAME_CONFIG.statsIntervalMs) this.emitStats();
    this.frame = requestAnimationFrame(next => this.loop(next));
  }

  /**
   * Advances simulation by a fixed duration, independent of display refresh rate.
   * @param {number} deltaMs Fixed update duration in milliseconds.
   */
  update(deltaMs) {
    this.moveAccumulator += deltaMs;
    while (this.moveAccumulator >= GAME_CONFIG.moveIntervalMs) {
      this.moveAccumulator -= GAME_CONFIG.moveIntervalMs;
      this.step();
      if (this.over) break;
    }
  }

  /** Advances all players by one grid cell and updates bot decisions. */
  step() {
    this.movePlayer(this.player);
    if (this.over) return;
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      bot.turnTimer--;
      if (bot.turnTimer <= 0 || this.random() < .025) {
        const [dx, dy] = this.randomDirection(bot);
        bot.next = [dx, dy];
        bot.turnTimer = 5 + Math.floor(this.random() * 12);
      }
      this.movePlayer(bot);
      if (this.over) return;
    }
  }

  /** Chooses a seeded, non-reversing direction for a bot. */
  randomDirection(current) {
    const options = DIRECTIONS.filter(([x, y]) => !(x === -current.dx && y === -current.dy));
    return options[Math.floor(this.random() * options.length)];
  }

  /** Moves one player, resolving bounds, trails, territory and captures. */
  movePlayer(player) {
    if (!player.alive) return;
    if (player.next) {
      const [dx, dy] = player.next;
      if (!isReverseDirection([player.dx, player.dy], [dx, dy])) {
        player.dx = dx;
        player.dy = dy;
      }
      player.next = null;
    }
    const nx = player.x + player.dx;
    const ny = player.y + player.dy;
    if (!this.grid.inside(nx, ny)) {
      if (player.human) this.endGame();
      else {
        player.dx *= -1;
        player.dy *= -1;
        player.next = null;
      }
      return;
    }

    const nextIndex = this.grid.index(nx, ny);
    if (this.grid.trail[nextIndex] === player.id) {
      if (player.human) this.endGame();
      else this.killBot(player);
      return;
    }

    const rival = findTrailCollision(nextIndex, player.id, [this.player, ...this.bots]);
    if (rival) {
      if (player.human) this.killBot(rival);
      else if (rival.human) this.killBot(player);
      else this.killBot(rival);
    }
    if (this.over || !player.alive) return;

    player.x = nx;
    player.y = ny;
    const owner = this.grid.owners[nextIndex];
    if (owner === player.id) {
      if (player.trailCells.length) {
        player.territory += captureArea(this.grid, player.id, player.trailCells);
        player.trailCells = [];
      }
    } else {
      this.grid.trail[nextIndex] = player.id;
      player.trailCells.push(nextIndex);
    }
  }

  /** Removes a defeated bot and its unclosed trail. */
  killBot(bot) {
    bot.alive = false;
    for (const index of bot.trailCells) this.grid.trail[index] = 0;
    bot.trailCells = [];
    this.callbacks.onBotDown?.(bot.id);
  }

  /** Ends the round and publishes the final HUD snapshot. */
  endGame() {
    if (this.over) return;
    this.over = true;
    const snapshot = this.getStats();
    this.callbacks.onGameOver?.(snapshot);
    this.emitStats();
  }

  /**
   * Builds a compact snapshot for the React HUD.
   * @returns {{territory:number,score:number,bots:number,over:boolean,paused:boolean,top5:Array<{id:number,score:number}>}}
   */
  getStats() {
    const counts = new Map();
    for (const owner of this.grid?.owners || []) {
      if (owner) counts.set(owner, (counts.get(owner) || 0) + 1);
    }
    const total = this.grid?.owners.length || 0;
    const score = counts.get(1) || 0;
    const top5 = [...counts.entries()]
      .map(([id, cells]) => ({ id, score: cells }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 5);
    return {
      territory: total ? Math.round(score / total * 100) : 0,
      score,
      bots: this.bots.filter(bot => bot.alive).length,
      over: this.over,
      paused: this.paused,
      top5
    };
  }

  /** Publishes a snapshot at the HUD cadence, never once per render frame. */
  emitStats() {
    this.lastStatsAt = performance.now();
    this.callbacks.onStats?.(this.getStats());
  }

  /** Draws the latest simulation state without advancing it. */
  draw() {
    if (!this.ctx || !this.grid) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    const ctx = this.ctx;
    const cellW = width / this.cellsWide;
    const cellH = height / this.cellsHigh;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#10131c';
    ctx.fillRect(0, 0, width, height);
    const owners = this.grid.owners;
    const trail = this.grid.trail;
    for (let y = 0; y < this.cellsHigh; y++) {
      for (let x = 0; x < this.cellsWide; x++) {
        const index = this.grid.index(x, y);
        const owner = owners[index];
        if (!owner && !trail[index]) continue;
        ctx.fillStyle = trail[index] ? COLORS[trail[index]] : COLORS[owner];
        ctx.globalAlpha = trail[index] ? .95 : .72;
        ctx.fillRect(x * cellW + .6, y * cellH + .6, Math.max(1, cellW - 1.2), Math.max(1, cellH - 1.2));
      }
    }
    ctx.globalAlpha = 1;
    this.drawPlayer(ctx, this.player, cellW, cellH);
    for (const bot of this.bots) if (bot.alive) this.drawPlayer(ctx, bot, cellW, cellH);
  }

  /** Draws one player marker. */
  drawPlayer(ctx, player, cellW, cellH) {
    if (!player?.alive) return;
    const color = COLORS[player.id] || '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x * cellW + 1, player.y * cellH + 1, Math.max(2, cellW - 2), Math.max(2, cellH - 2));
    ctx.fillStyle = color;
    ctx.fillRect(player.x * cellW + 2, player.y * cellH + 2, Math.max(1, cellW - 4), Math.max(1, cellH - 4));
  }

  /** Releases animation, observers and input listeners. Safe to call once. */
  destroy() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.unbindInput?.();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.callbacks = {};
  }
}
