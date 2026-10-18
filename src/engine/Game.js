import { captureArea } from './fill.js';
import { bindInput } from './input.js';
import { Grid } from './Grid.js';

const COLORS = {
  1: '#9b7bff',
  2: '#ff6685',
  3: '#ffbd59',
  4: '#42d9c0'
};
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const STEP_MS = 105;
const CELL_SIZE = 12;

function randomDirection(current) {
  const options = DIRECTIONS.filter(([x, y]) => !(x === -current.dx && y === -current.dy));
  return options[Math.floor(Math.random() * options.length)];
}

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.running = true;
    this.paused = false;
    this.over = false;
    this.frame = 0;
    this.lastTime = 0;
    this.accumulator = 0;
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

  resize() {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const width = Math.max(16, Math.floor(rect.width / CELL_SIZE));
    const height = Math.max(24, Math.floor(rect.height / CELL_SIZE));
    if (width !== this.cellsWide || height !== this.cellsHigh) {
      this.cellsWide = width;
      this.cellsHigh = height;
      this.reset();
    }
    this.draw();
  }

  reset() {
    if (!this.cellsWide || !this.cellsHigh) return;
    this.grid = new Grid(this.cellsWide, this.cellsHigh);
    const cx = Math.floor(this.cellsWide / 2);
    const cy = Math.floor(this.cellsHigh / 2);
    this.player = this.createPlayer(1, cx, cy, 1, 0, true);
    this.bots = [
      this.createPlayer(2, Math.floor(this.cellsWide * .22), Math.floor(this.cellsHigh * .28), 1, 0),
      this.createPlayer(3, Math.floor(this.cellsWide * .76), Math.floor(this.cellsHigh * .38), 0, 1),
      this.createPlayer(4, Math.floor(this.cellsWide * .70), Math.floor(this.cellsHigh * .76), -1, 0)
    ];
    this.over = false;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.initializeTerritory(this.player, 5, 4);
    for (const bot of this.bots) this.initializeTerritory(bot, 4, 3);
    this.emitStats();
  }

  createPlayer(id, x, y, dx, dy, human = false) {
    return {
      id, x, y, dx, dy, next: null, trailCells: [], alive: true,
      human, turnTimer: 0, territory: 0
    };
  }

  initializeTerritory(player, width, height) {
    const left = player.x - Math.floor(width / 2);
    const top = player.y - Math.floor(height / 2);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (this.grid.inside(x, y)) this.grid.setOwner(x, y, player.id);
      }
    }
  }

  queueDirection(dx, dy) {
    if (!this.running || this.paused || this.over) return;
    const current = this.player;
    if (!current?.alive) return;
    if (dx === -current.dx && dy === -current.dy) return;
    if (current.next && dx === -current.next[0] && dy === -current.next[1]) return;
    current.next = [dx, dy];
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.lastTime = 0;
  }

  restart() {
    this.reset();
  }

  loop(time) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = time;
    const delta = Math.min(time - this.lastTime, 100);
    this.lastTime = time;
    if (!this.paused && !this.over) {
      this.accumulator += delta;
      while (this.accumulator >= STEP_MS) {
        this.step();
        this.accumulator -= STEP_MS;
        if (this.over) break;
      }
    }
    this.draw();
    if (time - this.lastStatsAt > 150) this.emitStats();
    this.frame = requestAnimationFrame(next => this.loop(next));
  }

  step() {
    this.movePlayer(this.player);
    if (this.over) return;
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      bot.turnTimer--;
      if (bot.turnTimer <= 0 || Math.random() < .025) {
        const [dx, dy] = randomDirection(bot);
        bot.next = [dx, dy];
        bot.turnTimer = 5 + Math.floor(Math.random() * 12);
      }
      this.movePlayer(bot);
      if (this.over) return;
    }
  }

  movePlayer(player) {
    if (!player.alive) return;
    if (player.next) {
      const [dx, dy] = player.next;
      if (!(dx === -player.dx && dy === -player.dy)) {
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

    for (const rival of [this.player, ...this.bots]) {
      if (rival.id !== player.id && rival.alive && rival.trailCells.includes(nextIndex)) {
        if (rival.human) this.endGame();
        else this.killBot(rival);
      }
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

  killBot(bot) {
    bot.alive = false;
    for (const index of bot.trailCells) this.grid.trail[index] = 0;
    bot.trailCells = [];
    this.callbacks.onBotDown?.(bot.id);
  }

  endGame() {
    if (this.over) return;
    this.over = true;
    this.callbacks.onGameOver?.(this.getStats());
    this.emitStats();
  }

  getStats() {
    const owners = this.grid?.owners || [];
    let territory = 0;
    for (const owner of owners) if (owner === 1) territory++;
    return {
      territory: owners.length ? Math.round(territory / owners.length * 100) : 0,
      bots: this.bots.filter(bot => bot.alive).length,
      over: this.over,
      paused: this.paused
    };
  }

  emitStats() {
    this.lastStatsAt = performance.now();
    this.callbacks.onStats?.(this.getStats());
  }

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

  drawPlayer(ctx, player, cellW, cellH) {
    if (!player?.alive) return;
    const color = COLORS[player.id];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x * cellW + 1, player.y * cellH + 1, Math.max(2, cellW - 2), Math.max(2, cellH - 2));
    ctx.fillStyle = color;
    ctx.fillRect(player.x * cellW + 2, player.y * cellH + 2, Math.max(1, cellW - 4), Math.max(1, cellH - 4));
  }

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
