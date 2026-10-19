import { captureArea } from './fill.js';
import { Grid } from './Grid.js';
import { createMapMask } from './maps.js';
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
  constructor({ seed = GAME_CONFIG.seed, config = GAME_CONFIG, humanPlayer = true, mapId = 'circle' } = {}) {
    this.config = config;
    this.seed = seed >>> 0;
    this.humanPlayer = humanPlayer;
    this.mapId = mapId;
    this.events = new EventBus();
    this.reset();
  }

  reset() {
    this.random = mulberry32(this.seed);
    this.grid = new Grid(this.config.worldWidth, this.config.worldHeight, createMapMask(this.config.worldWidth, this.config.worldHeight, this.mapId));
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

    const reserved = [];
    const playerWidth = this.config.playerStartWidth;
    const playerHeight = this.config.playerStartHeight;
    if (this.humanPlayer) {
      const spawn = this.findSpawn(Math.round(this.cellsWide * 0.18), Math.floor(this.cellsHigh / 2), playerWidth, playerHeight, reserved);
      this.player = this.createPlayer(1, spawn.x, spawn.y, 1, 0, true);
      reserved.push(spawn);
    }

    const botCount = this.config.botCount;
    const ringRadius = Math.min(this.cellsWide, this.cellsHigh) * 0.32;
    for (let index = 0; index < botCount; index++) {
      const angle = (Math.PI * 2 * index) / botCount;
      const preferredX = Math.round(this.cellsWide / 2 + Math.cos(angle) * ringRadius);
      const preferredY = Math.round(this.cellsHigh / 2 + Math.sin(angle) * ringRadius);
      const width = this.config.botStartWidth;
      const height = this.config.botStartHeight;
      const spawn = this.findSpawn(preferredX, preferredY, width, height, reserved);
      reserved.push(spawn);
      const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
      const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
      const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
      const bot = this.createPlayer(index + (this.humanPlayer ? 2 : 1), spawn.x, spawn.y, dx || (dy ? 0 : 1), dy, false);
      bot.homeX = spawn.x;
      bot.homeY = spawn.y;
      bot.strategy = new BasicBot({
        random: this.random,
        difficulty: DIFFICULTIES[index % DIFFICULTIES.length]
      });
      this.bots.push(bot);
    }
    if (this.player) this.initializeTerritory(this.player, this.config.playerStartWidth, this.config.playerStartHeight);
    for (const bot of this.bots) this.initializeTerritory(bot, this.config.botStartWidth, this.config.botStartHeight);
  }

  findSpawn(preferredX, preferredY, width, height, reserved = []) {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    const candidates = [];
    for (let y = halfHeight + 1; y < this.cellsHigh - halfHeight - 1; y++) {
      for (let x = halfWidth + 1; x < this.cellsWide - halfWidth - 1; x++) {
        let safe = true;
        for (let yy = y - halfHeight; yy < y - halfHeight + height && safe; yy++) {
          for (let xx = x - halfWidth; xx < x - halfWidth + width; xx++) {
            if (!this.grid.inside(xx, yy) || this.grid.ownerAt(xx, yy) || this.grid.trailAt(xx, yy)) {
              safe = false;
              break;
            }
          }
        }
        if (!safe) continue;
        const separation = Math.max(width, height) + 2;
        if (reserved.some(point => Math.abs(point.x - x) < separation && Math.abs(point.y - y) < separation)) continue;
        const distance = (x - preferredX) ** 2 + (y - preferredY) ** 2;
        candidates.push({ x, y, distance });
      }
    }
    if (!candidates.length && reserved.length) return this.findSpawn(preferredX, preferredY, width, height, []);
    candidates.sort((a, b) => a.distance - b.distance);
    if (candidates.length) return candidates[0];
    for (let y = 1; y < this.cellsHigh - 1; y++) {
      for (let x = 1; x < this.cellsWide - 1; x++) {
        if (this.grid.inside(x, y)) return { x, y };
      }
    }
    throw new Error(`Map "${this.mapId}" has no safe spawn cells.`);
  }

  createPlayer(id, x, y, dx, dy, human = false) {
    const player = {
      id, x, y, dx, dy, next: null, trailCells: [], alive: true, human,
      turnTimer: 0, respawnTimer: 0, lifetime: 0, deaths: 0, kills: 0,
      lastHitBy: null, invulnerableTicks: 18, edgeTicks: 0
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

    // Prepare all directions before checking collisions, so iteration order cannot decide a head-on race.
    const active = [...this.players.values()].filter(player => player.alive);
    for (const player of active) {
      if (!player.human) {
        player.turnTimer--;
        if (player.turnTimer <= 0) {
          player.next = player.strategy.nextDirection(player, this);
          player.turnTimer = player.strategy.params.reactionTicks;
        }
      }
      if (player.next) {
        const [dx, dy] = player.next;
        if (!isReverseDirection([player.dx, player.dy], [dx, dy])) {
          player.dx = dx;
          player.dy = dy;
        }
        player.next = null;
      }
    }

    const plans = new Map();
    for (const player of active) {
      const x = player.x + player.dx, y = player.y + player.dy;
      plans.set(player.id, { player, fromX: player.x, fromY: player.y, x, y, blocked: !this.grid.inside(x, y) });
    }

    const pendingDeaths = new Map();
    const planList = [...plans.values()];
    for (let i = 0; i < planList.length; i++) {
      for (let j = i + 1; j < planList.length; j++) {
        const first = planList[i], second = planList[j];
        if (first.blocked || second.blocked || first.player.invulnerableTicks > 0 || second.player.invulnerableTicks > 0) continue;
        const sameCell = first.x === second.x && first.y === second.y;
        const crossing = first.x === second.fromX && first.y === second.fromY &&
          second.x === first.fromX && second.y === first.fromY;
        if (!sameCell && !crossing) continue;
        const losers = resolveHeadCollision(first.player, second.player);
        for (const loserId of losers) {
          const loser = this.players.get(loserId);
          if (loser?.alive) {
            const winner = losers.length === 1 ? (loserId === first.player.id ? second.player : first.player) : null;
            pendingDeaths.set(loserId, winner);
          }
        }
      }
    }

    for (const plan of planList) {
      if (plan.blocked || plan.player.invulnerableTicks > 0) continue;
      const index = this.grid.index(plan.x, plan.y);
      const trailOwnerId = this.grid.trail[index];
      if (!trailOwnerId || trailOwnerId === plan.player.id || pendingDeaths.has(trailOwnerId)) continue;
      const trailOwner = this.players.get(trailOwnerId);
      if (trailOwner?.alive && trailOwner.invulnerableTicks <= 0) pendingDeaths.set(trailOwnerId, plan.player);
    }

    this.resolvingTick = true;
    for (const player of active) {
      if (!player.alive) continue;
      const plan = plans.get(player.id);
      if (plan?.blocked) {
        player.edgeTicks = (player.edgeTicks || 0) + 1;
        const tangents = player.dx !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
        const tangent = tangents.find(([dx, dy]) => this.grid.inside(player.x + dx, player.y + dy));
        if (tangent) {
          [player.dx, player.dy] = tangent;
          player.edgeTicks++;
          this.movePlayer(player);
        }
        continue;
      }
      this.movePlayer(player);
      if (this.over) break;
    }
    this.resolvingTick = false;
    // Edge-boost substeps happen after the simultaneous movement phase.
    for (const player of active) {
      if (!player.alive) continue;
      const bonusMoves = Math.min(2, Math.floor((player.edgeTicks || 0) / 8));
      for (let bonus = 0; bonus < bonusMoves && player.alive; bonus++) this.movePlayer(player);
      if (this.over) break;
    }

    // Resolve every completed loop only after all participants have moved.
    for (const player of active) {
      if (!player.alive || !player.trailCells.length || this.grid.ownerAt(player.x, player.y) !== player.id) continue;
      const captured = captureArea(this.grid, player.id, player.trailCells);
      player.trailCells = [];
      if (player.human) this.sessionScore += captured;
      this.events.emit('capture', { playerId: player.id, human: player.human, captured, x: player.x, y: player.y });
      for (const victimId of this.grid.capturedTrailOwners ?? []) {
        if (victimId !== player.id && this.players.get(victimId)?.alive) pendingDeaths.set(victimId, player);
      }
    }

    for (const [victimId, killer] of pendingDeaths) {
      const victim = this.players.get(victimId);
      if (victim?.alive) this.eliminatePlayer(victim, killer);
    }
    if (!this.over) this.checkTerritoryLoss();
    for (const player of this.players.values()) if (player.alive && player.invulnerableTicks > 0) player.invulnerableTicks--;
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
      player.edgeTicks = (player.edgeTicks || 0) + 1;
      const tangents = player.dx !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
      const tangent = tangents.find(([dx, dy]) => this.grid.inside(player.x + dx, player.y + dy));
      if (!tangent) return;
      [player.dx, player.dy] = tangent;
      player.next = null;
      return this.movePlayer(player);
    }

    const nextIndex = this.grid.index(nx, ny);
    const rivalHead = this.resolvingTick ? null : [...this.players.values()].find(candidate =>
      candidate.id !== player.id && candidate.alive && candidate.x === nx && candidate.y === ny &&
      candidate.invulnerableTicks <= 0 && player.invulnerableTicks <= 0
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
    if (!this.resolvingTick && trailOwnerId && trailOwnerId !== player.id && player.invulnerableTicks <= 0) {
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
    player.edgeTicks = this.grid.isEdge(nx, ny) ? (player.edgeTicks || 0) + 1 : 0;

    if (this.resolvingTick) {
      if (this.grid.ownerAt(nx, ny) !== player.id && this.grid.trail[nextIndex] === 0) {
        this.grid.setTrail(nx, ny, player.id);
        player.trailCells.push(nextIndex);
      }
      return;
    }

    if (this.grid.ownerAt(nx, ny) === player.id) {
      if (player.trailCells.length) {
        const captured = captureArea(this.grid, player.id, player.trailCells);
        player.trailCells = [];
        for (const victimId of this.grid.capturedTrailOwners ?? []) {
          const victim = this.players.get(victimId);
          if (victim?.alive && victim.id !== player.id) this.eliminatePlayer(victim, player);
        }
        if (player.human) this.sessionScore += captured;
        this.events.emit('capture', { playerId: player.id, human: player.human, captured, x: player.x, y: player.y });
        this.checkTerritoryLoss();
      }
    } else if (this.grid.trail[nextIndex] !== player.id) {
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

    const attributedKiller = killer ?? (player.lastHitBy ? this.players.get(player.lastHitBy) : null);
    if (attributedKiller && attributedKiller.id !== player.id) {
      player.lastHitBy = attributedKiller.id;
      attributedKiller.kills = (attributedKiller.kills || 0) + 1;
    }
    const death = { playerId: player.id, human: player.human, killerId: attributedKiller?.id ?? null };
    this.events.emit('death', death);
    if (attributedKiller) this.events.emit('kill', { killerId: attributedKiller.id, victimId: player.id, killerHuman: attributedKiller.human, victimHuman: player.human });
    if (attributedKiller?.human && !player.human) this.sessionScore += 100;

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
      if (x < marginX || y < marginY || x >= this.cellsWide - marginX || y >= this.cellsHigh - marginY || !this.grid.inside(x, y)) continue;
      let free = true;
      for (let yy = y - Math.floor(height / 2); yy < y - Math.floor(height / 2) + height && free; yy++) {
        for (let xx = x - Math.floor(width / 2); xx < x - Math.floor(width / 2) + width; xx++) {
          const cell = this.grid.index(xx, yy);
          if (!this.grid.inside(xx, yy) || this.grid.owners[cell] || this.grid.trail[cell]) { free = false; break; }
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
      alive: true, respawnTimer: 0, turnTimer: 0, invulnerableTicks: 18, edgeTicks: 0, lastHitBy: null
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
    const total = this.grid.walkableCount;
    return {
      territory: total ? Math.round(score / total * 100) : 0,
      score,
      sessionScore: this.sessionScore,
      bots: this.bots.filter(bot => bot.alive).length,
      respawning: Boolean(this.player && !this.player.alive),
      over: this.over,
      paused: this.paused,
      top5,
      kills: this.player?.kills || 0,
      playerStats: players.map(player => ({ id: player.id, kills: player.kills || 0, deaths: player.deaths, alive: player.alive, territory: this.grid.territoryCount(player.id), x: player.x, y: player.y }))
    };
  }
}
