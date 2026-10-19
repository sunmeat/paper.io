import { captureArea } from './fill.js';
import { Grid } from './Grid.js';
import { findTrailCollision } from './collisions.js';
import { isReverseDirection } from './directions.js';
import { mulberry32 } from './random.js';
import { resolveHeadCollision, resolveTrailCrossing } from './rules.js';
import { BasicBot } from './bots/index.js';
import { GAME_CONFIG } from './config.js';

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const DIFFICULTIES = ['easy', 'normal', 'hard'];

/** Small event bus shared by gameplay, UI adapters and headless simulations. */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.off(type, listener);
  }

  off(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, payload) {
    for (const listener of this.listeners.get(type) ?? []) listener(payload);
  }

  clear() {
    this.listeners.clear();
  }
}

/** Deterministic, DOM-free game world. All gameplay rules live here. */
export class Simulation {
  constructor({ seed = GAME_CONFIG.seed, config = GAME_CONFIG, humanPlayer = true } = {}) {
    this.config = config;
    this.seed = seed >>> 0;
    this.humanPlayer = humanPlayer;
    this.events = new EventBus();
    this.reset();
  }

  reset() {
    this.random = mulberry32(this.seed);
    this.grid = new Grid(this.config.worldWidth, this.config.worldHeight);
    this.cellsWide = this.config.worldWidth;
    this.cellsHigh = this.config.worldHeight;
    this.players = new Map();
    this.player = null;
    this.bots = [];
    this.sessionScore = 0;
    this.over = false;
    this.paused = false;
    this.moveAccumulator = 0;
    this.tick = 0;

    const safeX = Math.round(this.cellsWide * 0.18);
    const safeY = Math.floor(this.cellsHigh / 2);
    if (this.humanPlayer) this.player = this.createPlayer(1, safeX, safeY, 1, 0, true);

    const botCount = this.config.botCount;
    const ringRadius = Math.min(this.cellsWide, this.cellsHigh) * 0.38;
    for (let index = 0; index < botCount; index++) {
      const angle = (Math.PI * 2 * index) / botCount;
      const x = Math.round(this.cellsWide / 2 + Math.cos(angle) * ringRadius);
      const y = Math.round(this.cellsHigh / 2 + Math.sin(angle) * ringRadius);
      const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
      const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
      const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
      const bot = this.createPlayer(index + (this.humanPlayer ? 2 : 1), x, y, dx || (dy ? 0 : 1), dy, false);
      bot.homeX = x;
      bot.homeY = y;
      bot.strategy = new BasicBot({
        random: this.random,
        difficulty: DIFFICULTIES[index % DIFFICULTIES.length]
      });
      this.bots.push(bot);
    }

    if (this.player) this.initializeTerritory(this.player, this.config.playerStartWidth, this.config.playerStartHeight);
    for (const bot of this.bots) this.initializeTerritory(bot, this.config.botStartWidth, this.config.botStartHeight);
  }

  createPlayer(id, x, y, dx, dy, human = false) {
    const player = {
      id, x, y, dx, dy, next: null, trailCells: [], alive: true, human,
      turnTimer: 0, respawnTimer: 0, lifetime: 0, deaths: 0
    };
    this.players.set(id, player);
    return player;
  }

  initializeTerritory(player, width, height) {
    const left = player.x - Math.floor(width / 2);
    const top = player.y - Math.floor(height / 2);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (this.grid.inside(x, y) && !this.grid.ownerAt(x, y) && !this.grid.trailAt(x, y)) {
          this.grid.setOwner(x, y, player.id);
        }
      }
    }
  }

  queueDirection(dx, dy) {
    if (this.paused || this.over || !this.player?.alive) return;
    const player = this.player;
    if (isReverseDirection([player.dx, player.dy], [dx, dy])) return;
    if (player.next && isReverseDirection(player.next, [dx, dy])) return;
    player.next = [dx, dy];
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  update(deltaMs) {
    if (this.paused || this.over) return;
    this.moveAccumulator += deltaMs;
    while (this.moveAccumulator >= this.config.moveIntervalMs) {
      this.moveAccumulator -= this.config.moveIntervalMs;
      this.step();
      if (this.over) break;
    }
  }

  step() {
    if (this.paused || this.over) return;
    this.tick++;
    for (const player of this.players.values()) {
      if (player.alive) continue;
      player.respawnTimer--;
      if (player.respawnTimer <= 0) this.respawnPlayer(player);
    }

    if (this.player?.alive) this.movePlayer(this.player);
    if (this.over) return;

    for (const bot of this.bots) {
      if (!bot.alive) continue;
      bot.turnTimer--;
      if (bot.turnTimer <= 0) {
        bot.next = bot.strategy.nextDirection(bot, this);
        bot.turnTimer = bot.strategy.params.reactionTicks;
      }
      this.movePlayer(bot);
    }
  }

  randomDirection(current) {
    const options = DIRECTIONS.filter(([x, y]) => !(x === -current.dx && y === -current.dy));
    return options[Math.floor(this.random() * options.length)];
  }

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
      if (player.human) this.eliminatePlayer(player);
      else {
        player.dx *= -1;
        player.dy *= -1;
        player.next = null;
      }
      return;
    }

    const nextIndex = this.grid.index(nx, ny);
    if (this.grid.trail[nextIndex] === player.id) {
      this.eliminatePlayer(player);
      return;
    }

    const rivalHead = [...this.players.values()].find(candidate =>
      candidate.id !== player.id && candidate.alive && candidate.x === nx && candidate.y === ny
    );
    if (rivalHead) {
      const losers = resolveHeadCollision(player, rivalHead);
      for (const loserId of losers) {
        const loser = this.players.get(loserId);
        if (loser?.alive) {
          const killer = losers.length === 1 ? (loser.id === player.id ? rivalHead : player) : null;
          this.eliminatePlayer(loser, killer);
        }
      }
      if (!player.alive) return;
    }

    const trailOwnerId = this.grid.trail[nextIndex];
    if (trailOwnerId && trailOwnerId !== player.id) {
      const trailOwner = findTrailCollision(nextIndex, player.id, this.players.values()) ?? this.players.get(trailOwnerId);
      if (trailOwner?.alive) {
        const loserId = resolveTrailCrossing(player.id, trailOwnerId);
        const loser = this.players.get(loserId);
        if (loser) this.eliminatePlayer(loser, player);
      }
      if (!player.alive) return;
    }

    player.x = nx;
    player.y = ny;
    player.lifetime++;

    if (this.grid.ownerAt(nx, ny) === player.id) {
      if (player.trailCells.length) {
        const captured = captureArea(this.grid, player.id, player.trailCells);
        player.trailCells = [];
        if (player.human) this.sessionScore += captured;
        this.events.emit('capture', { playerId: player.id, human: player.human, captured, x: player.x, y: player.y });
        this.checkTerritoryLoss();
      }
    } else {
      this.grid.setTrail(nx, ny, player.id);
      player.trailCells.push(nextIndex);
    }
  }

  eliminatePlayer(player, killer = null) {
    if (!player?.alive) return;
    player.alive = false;
    player.deaths++;
    player.respawnTimer = player.human ? 0 : this.config.respawnSteps;
    this.grid.clearTerritory(player.id);
    this.grid.clearTrail(player.id);
    player.trailCells = [];
    player.next = null;

    const death = { playerId: player.id, human: player.human, killerId: killer?.id ?? null };
    this.events.emit('death', death);
    if (killer) this.events.emit('kill', { killerId: killer.id, victimId: player.id, killerHuman: killer.human, victimHuman: player.human });
    if (killer?.human && !player.human) this.sessionScore += 100;

    if (player.human) {
      this.over = true;
      this.paused = true;
      this.events.emit('gameOver', this.getStats());
    }
  }

  checkTerritoryLoss() {
    for (const player of this.players.values()) {
      if (player.alive && this.grid.territoryCount(player.id) === 0) this.eliminatePlayer(player);
    }
  }

  respawnPlayer(player) {
    const width = player.human ? this.config.playerStartWidth : this.config.botStartWidth;
    const height = player.human ? this.config.playerStartHeight : this.config.botStartHeight;
    const marginX = Math.ceil(width / 2) + 1;
    const marginY = Math.ceil(height / 2) + 1;
    let spawn = null;
    const start = Math.floor(this.random() * this.grid.owners.length);

    for (let offset = 0; offset < this.grid.owners.length; offset++) {
      const index = (start + offset) % this.grid.owners.length;
      const x = index % this.cellsWide;
      const y = Math.floor(index / this.cellsWide);
      if (x < marginX || y < marginY || x >= this.cellsWide - marginX || y >= this.cellsHigh - marginY) continue;
      let free = true;
      for (let yy = y - Math.floor(height / 2); yy < y - Math.floor(height / 2) + height && free; yy++) {
        for (let xx = x - Math.floor(width / 2); xx < x - Math.floor(width / 2) + width; xx++) {
          const cell = this.grid.index(xx, yy);
          if (this.grid.owners[cell] || this.grid.trail[cell]) { free = false; break; }
        }
      }
      if (free) { spawn = { x, y }; break; }
    }

    if (!spawn) {
      player.respawnTimer = 1;
      return;
    }

    const [dx, dy] = this.randomDirection(player);
    Object.assign(player, {
      x: spawn.x, y: spawn.y, dx, dy, next: null, trailCells: [],
      alive: true, respawnTimer: 0, turnTimer: 0
    });
    this.initializeTerritory(player, width, height);
  }

  /** Adapter point for future powerups; gameplay and UI can subscribe without callbacks. */
  collectPowerup(playerId, powerup) {
    const player = this.players.get(playerId);
    if (!player?.alive) return false;
    this.events.emit('powerup', { playerId, powerup });
    return true;
  }

  getStats() {
    const players = [...this.players.values()];
    const top5 = players
      .map(player => ({ id: player.id, score: this.grid.territoryCount(player.id) }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 5);
    const score = this.player ? this.grid.territoryCount(this.player.id) : 0;
    const total = this.grid.owners.length;
    return {
      territory: total ? Math.round(score / total * 100) : 0,
      score,
      sessionScore: this.sessionScore,
      bots: this.bots.filter(bot => bot.alive).length,
      respawning: Boolean(this.player && !this.player.alive),
      over: this.over,
      paused: this.paused,
      top5
    };
  }
}
