import { captureArea } from './fill.js';
import { Grid } from './Grid.js';
import { createMapMask } from './maps.js';
import { findTrailCollision } from './collisions.js';
import { isReverseDirection } from './directions.js';
import { mulberry32 } from './random.js';
import { resolveHeadCollision, resolveTrailCrossing } from './rules.js';
import { BasicBot, BOT_PERSONALITY_IDS, getBotDifficulty } from './bots/index.js';
import { GAME_CONFIG } from './config.js';
import { evaluateRoundOutcome, GAME_MODES } from './modes.js';
import { POWERUPS, POWERUP_IDS, POWERUP_SPAWN_INTERVAL, POWERUP_MAX_PICKUPS, POWERUP_LIFETIME_TICKS } from './powerups.js';

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

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
  constructor({ seed = GAME_CONFIG.seed, config = null, humanPlayer = true, mapId = 'circle', playerLevel = 1, winStreak = 0, lossStreak = 0, modeId = 'classic' } = {}) {
    this.modeId = GAME_MODES[modeId] ? modeId : 'classic';
    this.mode = GAME_MODES[this.modeId];
    this.config = { ...GAME_CONFIG, ...this.mode.config, ...(config || {}) };
    this.seed = seed >>> 0;
    this.humanPlayer = humanPlayer;
    this.mapId = mapId;
    this.playerProgress = { playerLevel, winStreak, lossStreak };
    this.observer = !humanPlayer;
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
    this.elapsedMs = 0;
    this.outcome = null;
    this.winnerId = null;
    this._leaderId = null;
    this.hasResolvedLeader = false;
    this.secretConquered = false;
    this.maxTerritory = 0;
    this.maxTerritoryCells = 0;
    this.finalTerritoryOwners = null;
    this.deathKillerId = null;
    this.revivesUsed = 0;
    this.deathReason = null;
    this.pickups = [];
    this.nextPowerupId = 1;

    this.initializing = true;
    this.botCount = this.config.botCount;
    const reserved = [];
    const difficulty = getBotDifficulty(this.playerProgress);
    const ringRadius = Math.min(this.cellsWide, this.cellsHigh) * 0.32;
    for (let index = 0; index < this.botCount; index++) {
      const angle = (Math.PI * 2 * index) / this.botCount;
      const preferredX = Math.round(this.cellsWide / 2 + Math.cos(angle) * ringRadius);
      const preferredY = Math.round(this.cellsHigh / 2 + Math.sin(angle) * ringRadius);
      const width = 4 + Math.floor(this.random() * 9);
      const height = 4 + Math.floor(this.random() * 9);
      const spawn = this.findSpawn(preferredX, preferredY, width, height, reserved);
      reserved.push({ x: spawn.x, y: spawn.y, width, height });
      const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
      const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
      const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
      const bot = this.createPlayer(index + (this.humanPlayer ? 2 : 1), spawn.x, spawn.y, dx || (dy ? 0 : 1), dy, false);
      bot.homeX = spawn.x;
      bot.homeY = spawn.y;
      bot.startWidth = width;
      bot.startHeight = height;
      bot.alive = false;
      bot.respawnTimer = 1 + Math.floor(this.random() * 90);
      const personality = BOT_PERSONALITY_IDS[Math.floor(this.random() * BOT_PERSONALITY_IDS.length)];
      bot.strategy = new BasicBot({ random: this.random, difficulty, personality });
      bot.name = `${bot.strategy.name} ${index + 1}`;
      bot.strategy.name = bot.name;
      bot.personality = personality;
      this.bots.push(bot);
    }

    for (let tick = 0; tick < 280; tick++) this.step();

    for (const bot of this.bots) {
      bot.invulnerableTicks = 18;
      bot.kills = 0;
      bot.deaths = 0;
      bot.lastHitBy = null;
      bot.lifetime = 0;
      bot.currentLifeTicks = 0;
      bot.totalLifeTicks = 0;
      bot.livesCompleted = 0;
    }

    if (this.humanPlayer) {
      const playerWidth = this.config.playerStartWidth;
      const playerHeight = this.config.playerStartHeight;
      const spawn = this.findSpawn(
        Math.round(this.cellsWide * 0.18),
        Math.floor(this.cellsHigh / 2),
        playerWidth,
        playerHeight,
        [],
        { minDistance: Math.max(16, Math.floor(Math.min(this.cellsWide, this.cellsHigh) * 0.2)), farFromPlayers: true }
      );
      this.player = this.createPlayer(1, spawn.x, spawn.y, 1, 0, true);
      this.initializeTerritory(this.player, playerWidth, playerHeight);
      this.updateMaxTerritory();
    }
    this.initializing = false;
  }

  findSpawn(preferredX, preferredY, width, height, reserved = [], { minDistance = 0, farFromPlayers = false, ignorePlayerId = null } = {}) {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    const candidates = [];
    const others = [...this.players.values()].filter(other => other.alive && other.id !== ignorePlayerId);
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
        if (reserved.some(point => Math.abs(point.x - x) < Math.max(separation, (point.width || 0) / 2 + width / 2 + 2) &&
          Math.abs(point.y - y) < Math.max(separation, (point.height || 0) / 2 + height / 2 + 2))) continue;
        const nearest = others.reduce((distance, other) => {
          const territoryRadius = Math.max(other.startWidth || 0, other.startHeight || 0) / 2;
          return Math.min(distance, Math.hypot(other.x - x, other.y - y) - territoryRadius);
        }, Infinity);
        if (nearest < minDistance) continue;
        candidates.push({ x, y, distance: (x - preferredX) ** 2 + (y - preferredY) ** 2, nearest });
      }
    }
    if (!candidates.length && (reserved.length || minDistance > 0)) {
      return this.findSpawn(preferredX, preferredY, width, height, [], { minDistance: 0, farFromPlayers, ignorePlayerId });
    }
    candidates.sort((a, b) => farFromPlayers
      ? b.nearest - a.nearest || a.distance - b.distance
      : a.distance - b.distance);
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
      id, x, y, prevX: x, prevY: y, dx, dy, next: null, turnQueue: [], trailCells: [], alive: true, human,
      turnTimer: 0, respawnTimer: 0, lifetime: 0, currentLifeTicks: 0, totalLifeTicks: 0, livesCompleted: 0, deaths: 0, kills: 0,
      startWidth: human ? this.config.playerStartWidth : this.config.botStartWidth,
      startHeight: human ? this.config.playerStartHeight : this.config.botStartHeight,
      lastHitBy: null, invulnerableTicks: 18, edgeTicks: 0, closedLoop: false, effects: { speed: 0, shield: 0, bigCapture: 0, freeze: 0 }, frozenTicks: 0
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
    if (this.paused || this.over || !this.player?.alive) return false;
    const player = this.player;
    const queue = player.turnQueue;
    if (queue.length >= 2) return false;
    const previous = queue.length ? queue[queue.length - 1] : [player.dx, player.dy];
    if (isReverseDirection(previous, [dx, dy])) return false;
    if (previous[0] === dx && previous[1] === dy) return false;
    queue.push([dx, dy]);
    return true;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  update(deltaMs) {
    if (this.paused || this.over) return;
    this.elapsedMs += Math.max(0, deltaMs || 0);
    this.checkRoundOutcome();
    if (this.over) return;
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
      for (const id of POWERUP_IDS) if (player.effects?.[id] > 0) player.effects[id]--;
      if (player.frozenTicks > 0) player.frozenTicks--;
    }
    if (this.mode.powerups) this.updatePickups();
    if (this.tick % 30 === 0) this.reconcileBotPopulation();
    for (const player of this.players.values()) {
      if (player.alive) continue;
      player.respawnTimer--;
      if (player.respawnTimer <= 0) this.respawnPlayer(player);
    }

    // Prepare all directions before checking collisions, so iteration order cannot decide a head-on race.
    const active = [...this.players.values()].filter(player => player.alive && player.frozenTicks <= 0);
    for (const player of active) {
      if (!player.human) {
        player.turnTimer--;
        if (player.turnTimer <= 0) {
          player.next = player.strategy.nextDirection(player, this);
          player.turnTimer = player.strategy.params.reactionTicks;
        }
      }
      if (player.human && player.turnQueue.length) player.next = player.turnQueue.shift();
      if (player.next) {
        const [dx, dy] = player.next;
        if (!isReverseDirection([player.dx, player.dy], [dx, dy])) {
          player.dx = dx;
          player.dy = dy;
        }
        player.next = null;
      }
    }

    for (const player of active) {
      player.prevX = player.x;
      player.prevY = player.y;
    }

    const plans = new Map();
    for (const player of active) {
      const x = player.x + player.dx, y = player.y + player.dy;
      plans.set(player.id, { player, fromX: player.x, fromY: player.y, x, y, blocked: !this.grid.inside(x, y) });
    }

    const pendingDeaths = new Map();
    const pendingTerritoryTransfers = new Set();
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
      if (trailOwner?.alive && trailOwner.invulnerableTicks <= 0) {
        pendingDeaths.set(trailOwnerId, plan.player);
        pendingTerritoryTransfers.add(trailOwnerId);
      }
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
    // Speed powerups grant one extra cell; hugging the border no longer accelerates every character.
    for (const player of active) {
      if (!player.alive || player.effects?.speed <= 0) continue;
      this.movePlayer(player);
      if (this.over) break;
    }

    // A loop closes when a player returns to territory or crosses their own trail.
    for (const player of active) {
      if (!player.alive || !player.trailCells.length ||
          (!player.closedLoop && this.grid.ownerAt(player.x, player.y) !== player.id)) continue;
      const captured = captureArea(this.grid, player.id, player.trailCells);
      player.trailCells = [];
      player.closedLoop = false;
      if (player.human) this.sessionScore += captured;
      this.events.emit('capture', { playerId: player.id, human: player.human, captured, x: player.x, y: player.y });
      for (const victimId of this.grid.capturedTrailOwners ?? []) {
        if (victimId !== player.id && this.players.get(victimId)?.alive) pendingDeaths.set(victimId, player);
      }
    }

    for (const [victimId, killer] of pendingDeaths) {
      const victim = this.players.get(victimId);
      if (victim?.alive) this.eliminatePlayer(victim, killer, { transferTerritory: pendingTerritoryTransfers.has(victimId) });
    }
    this.updateMaxTerritory();
    if (!this.over) this.checkTerritoryLoss();
    for (const player of this.players.values()) if (player.alive && player.invulnerableTicks > 0) player.invulnerableTicks--;
    if (!this.over) this.checkRoundOutcome();
  }

  updateMaxTerritory() {
    if (!this.player) return;
    const cells = this.grid.territoryCount(this.player.id);
    if (cells > this.maxTerritoryCells) {
      this.maxTerritoryCells = cells;
      this.maxTerritory = Number((cells / Math.max(1, this.grid.walkableCount) * 100).toFixed(3));
    }
  }

  checkRoundOutcome() {
    if (this.initializing || this.over || !this.humanPlayer || !this.player || !this.botCount) return;
    const total = this.grid.walkableCount || 1;
    const territoryPercent = player => this.grid.territoryCount(player.id) / total * 100;
    const playerTerritory = this.player ? territoryPercent(this.player) : 0;
    const topTerritory = Math.max(0, ...[...this.players.values()].filter(player => player.id !== 1).map(territoryPercent));
    const outcome = evaluateRoundOutcome({
      modeId: this.modeId,
      elapsedMs: this.elapsedMs,
      playerAlive: Boolean(this.player?.alive),
      playerTerritory,
      topTerritory,
      aliveBots: this.bots.filter(bot => bot.alive).length
    });
    if (outcome) this.finishRound(outcome);
  }

  finishRound(outcome) {
    if (this.over) return;
    this.outcome = outcome;
    this.winnerId = outcome === 'victory' ? 1 : null;
    const total = this.grid.walkableCount || 1;
    this.secretConquered = Boolean(this.player && this.grid.territoryCount(this.player.id) >= total);
    this.updateMaxTerritory();
    this.finalTerritoryOwners = new Uint16Array(this.grid.owners);
    this.over = true;
    this.paused = true;
    this.events.emit('gameOver', this.getStats());
  }

  revive() {
    const player = this.player;
    if (!player || player.alive || this.revivesUsed >= 1 || this.outcome !== 'defeat' || this.deathReason !== 'death') return false;
    this.respawnPlayer(player);
    player.invulnerableTicks = 30;
    this.revivesUsed++;
    this.over = false;
    this.paused = false;
    this.outcome = null;
    this.winnerId = null;
    this.deathReason = null;
    this.finalTerritoryOwners = null;
    this.deathKillerId = null;
    this.events.emit('revive', { playerId: player.id, revivesUsed: this.revivesUsed });
    return true;
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
        if (loser) this.eliminatePlayer(loser, player, { transferTerritory: loserId === trailOwnerId });
      }
      if (!player.alive) return;
    }

    player.x = nx;
    player.y = ny;
    if (trailOwnerId === player.id && player.trailCells.length) player.closedLoop = true;
    this.collectPickupAt(player, nx, ny);
    player.lifetime++;
    player.currentLifeTicks++;
    player.edgeTicks = this.grid.isEdge(nx, ny) ? (player.edgeTicks || 0) + 1 : 0;

    if (this.resolvingTick) {
      if (this.grid.ownerAt(nx, ny) !== player.id && this.grid.trail[nextIndex] === 0) {
        this.grid.setTrail(nx, ny, player.id);
        player.trailCells.push(nextIndex);
      }
      return;
    }

    if (this.grid.ownerAt(nx, ny) === player.id || (trailOwnerId === player.id && player.trailCells.length)) {
      if (player.trailCells.length) {
        const captured = captureArea(this.grid, player.id, player.trailCells);
        player.trailCells = [];
        player.closedLoop = false;
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

  eliminatePlayer(player, killer = null, { transferTerritory = false } = {}) {
    if (!player?.alive) return;
    const attributedKiller = killer ?? (player.lastHitBy ? this.players.get(player.lastHitBy) : null);
    this.updateMaxTerritory();
    const territoryCells = [];
    for (let index = 0; index < this.grid.owners.length; index++) {
      if (this.grid.owners[index] === player.id) territoryCells.push(index);
    }
    if (player.human) this.deathKillerId = attributedKiller?.id ?? null;
    if (transferTerritory && attributedKiller && attributedKiller.id !== player.id) {
      for (let index = 0; index < this.grid.owners.length; index++) {
        if (this.grid.owners[index] === player.id) this.grid.setOwnerAt(index, attributedKiller.id);
      }
    }
    if (player.human) this.finalTerritoryOwners = new Uint16Array(this.grid.owners);
    player.alive = false;
    player.deaths++;
    player.totalLifeTicks = (player.totalLifeTicks || 0) + (player.currentLifeTicks || 0);
    player.livesCompleted = (player.livesCompleted || 0) + 1;
    player.currentLifeTicks = 0;
    player.respawnTimer = player.human ? 0 : 30 + Math.floor(this.random() * 31);
    this.grid.clearTerritory(player.id);
    this.grid.clearTrail(player.id);
    player.trailCells = [];
    player.next = null;

    if (attributedKiller && attributedKiller.id !== player.id) {
      player.lastHitBy = attributedKiller.id;
      attributedKiller.kills = (attributedKiller.kills || 0) + 1;
    }
    const death = { playerId: player.id, human: player.human, killerId: attributedKiller?.id ?? null, territoryCells };
    this.events.emit('death', death);
    if (attributedKiller) this.events.emit('kill', { killerId: attributedKiller.id, victimId: player.id, killerHuman: attributedKiller.human, victimHuman: player.human });
    if (attributedKiller?.human && !player.human) this.sessionScore += 100;

    if (player.human) {
      this.deathReason = 'death';
      this.outcome = 'defeat';
      this.winnerId = null;
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
    const width = player.human ? this.config.playerStartWidth : (player.startWidth || this.config.botStartWidth);
    const height = player.human ? this.config.playerStartHeight : (player.startHeight || this.config.botStartHeight);
    const spawn = this.findSpawn(
      player.homeX ?? Math.floor(this.cellsWide / 2),
      player.homeY ?? Math.floor(this.cellsHigh / 2),
      width,
      height,
      [],
      {
        minDistance: player.human ? 0 : Math.max(12, Math.floor(Math.min(this.cellsWide, this.cellsHigh) * 0.18)),
        farFromPlayers: true,
        ignorePlayerId: player.id
      }
    );

    const [dx, dy] = this.randomDirection(player);
    Object.assign(player, {
      x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y, dx, dy, next: null, turnQueue: [], trailCells: [],
      alive: true, respawnTimer: 0, turnTimer: 0, invulnerableTicks: 18, edgeTicks: 0, lastHitBy: null, effects: { speed: 0, shield: 0, bigCapture: 0, freeze: 0 }, frozenTicks: 0
    });
    player.homeX = spawn.x;
    player.homeY = spawn.y;
    this.initializeTerritory(player, width, height);
  }

  reconcileBotPopulation() {
    const aliveBots = this.bots.filter(bot => bot.alive).length;
    if (aliveBots >= this.botCount) return;
    const waiting = this.bots.filter(bot => !bot.alive);
    const missing = this.botCount - aliveBots;
    for (const bot of waiting.slice(0, missing)) {
      if (bot.respawnTimer <= 0) bot.respawnTimer = 1 + Math.floor(this.random() * 30);
    }
  }

  updatePickups() {
    this.pickups = this.pickups.filter(pickup => pickup.expiresAtTick > this.tick);
    if (this.tick % POWERUP_SPAWN_INTERVAL !== 0 || this.pickups.length >= POWERUP_MAX_PICKUPS) return;
    const candidates = [];
    for (let y = 1; y < this.cellsHigh - 1; y++) {
      for (let x = 1; x < this.cellsWide - 1; x++) {
        const index = this.grid.index(x, y);
        if (this.grid.inside(x, y) && !this.grid.owners[index] && !this.grid.trail[index] &&
          !this.pickups.some(pickup => pickup.x === x && pickup.y === y)) candidates.push({ x, y });
      }
    }
    if (!candidates.length) return;
    const cell = candidates[Math.floor(this.random() * candidates.length)];
    const powerup = POWERUPS[Math.floor(this.random() * POWERUPS.length)];
    const pickup = { id: this.nextPowerupId++, powerup: powerup.id, x: cell.x, y: cell.y, expiresAtTick: this.tick + POWERUP_LIFETIME_TICKS };
    this.pickups.push(pickup);
    this.events.emit('pickupSpawn', pickup);
  }

  collectPickupAt(player, x, y) {
    const index = this.pickups.findIndex(pickup => pickup.x === x && pickup.y === y);
    if (index < 0) return false;
    const [pickup] = this.pickups.splice(index, 1);
    return this.collectPowerup(player.id, pickup.powerup);
  }

  collectPowerup(playerId, powerupId) {
    const player = this.players.get(playerId);
    const powerup = POWERUPS.find(item => item.id === powerupId);
    if (!player?.alive || !powerup) return false;
    player.effects ||= { speed: 0, shield: 0, bigCapture: 0, freeze: 0 };
    player.effects[powerup.id] = powerup.durationTicks;
    if (powerup.id === 'shield') player.invulnerableTicks = 100;
    if (powerup.id === 'bigCapture') {
      const radius = 5;
      let captured = 0;
      for (let y = player.y - radius; y <= player.y + radius; y++) {
        for (let x = player.x - radius; x <= player.x + radius; x++) {
          if ((x - player.x) ** 2 + (y - player.y) ** 2 > radius ** 2 || !this.grid.inside(x, y)) continue;
          const index = this.grid.index(x, y);
          if (this.grid.owners[index] !== player.id) captured++;
          this.grid.setOwnerAt(index, player.id);
        }
      }
      this.updateMaxTerritory();
      this.events.emit('capture', { playerId, human: player.human, captured, x: player.x, y: player.y, powerup: true });
    }
    if (powerup.id === 'freeze') {
      for (const other of this.players.values()) if (other.alive && other.id !== playerId) other.frozenTicks = Math.max(other.frozenTicks || 0, powerup.durationTicks);
    }
    this.events.emit('powerup', { playerId, powerup: powerup.id });
    return true;
  }

  get leaderId() {
    return this._leaderId;
  }

  getStats() {
    const players = [...this.players.values()];
    const finalCounts = this.over && this.finalTerritoryOwners
      ? this.finalTerritoryOwners.reduce((counts, owner) => {
          if (owner) counts[owner] = (counts[owner] || 0) + 1;
          return counts;
        }, {})
      : null;
    const territoryCount = playerId => finalCounts ? finalCounts[playerId] || 0 : this.grid.territoryCount(playerId);
    const playerStats = players.map(player => ({
      id: player.id,
      kills: player.kills || 0,
      deaths: player.deaths,
      alive: player.alive,
      territory: territoryCount(player.id),
      x: player.x,
      y: player.y
    }));
    const ranked = [...playerStats].sort((a, b) => b.territory - a.territory || a.id - b.id);
    const total = this.grid.walkableCount || 1;
    const candidate = ranked.find(player => player.territory > 0) || null;
    const current = playerStats.find(player => player.id === this._leaderId);
    const margin = total * 0.005;
    const nextLeader = !current || current.territory <= 0
      ? candidate?.id ?? null
      : candidate && candidate.id !== current.id && candidate.territory >= current.territory + margin
        ? candidate.id
        : current.id;
    if (nextLeader !== this._leaderId) {
      const previousLeaderId = this._leaderId;
      this._leaderId = nextLeader;
      if (this.hasResolvedLeader) this.events.emit('leaderChange', { previousLeaderId, leaderId: nextLeader });
    }
    this.hasResolvedLeader = true;
    const top5 = ranked.slice(0, 5);
    if (this._leaderId != null && top5.some(player => player.id === this._leaderId)) {
      top5.sort((a, b) => (a.id === this._leaderId ? -1 : b.id === this._leaderId ? 1 : b.territory - a.territory));
    }
    const score = this.player ? territoryCount(this.player.id) : 0;
    return {
      territory: total ? Number((score / total * 100).toFixed(3)) : 0,
      modeId: this.modeId,
      elapsedMs: this.elapsedMs,
      outcome: this.outcome,
      winnerId: this.winnerId,
      killerId: this.deathKillerId,
      maxTerritory: this.maxTerritory,
      maxTerritoryCells: this.maxTerritoryCells,
      secretConquered: this.secretConquered,
      score,
      sessionScore: this.sessionScore,
      bots: this.bots.filter(bot => bot.alive).length,
      respawning: Boolean(this.player && !this.player.alive),
      over: this.over,
      paused: this.paused,
      top5,
      leaderId: this._leaderId,
      kills: this.player?.kills || 0,
      effects: this.player ? POWERUP_IDS.map(id => ({ id, ticksLeft: this.player.effects?.[id] || 0, durationTicks: POWERUPS.find(powerup => powerup.id === id).durationTicks })).filter(effect => effect.ticksLeft > 0) : [],
      playerStats
    };
  }
}
