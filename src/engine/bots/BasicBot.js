import { BOT_DIFFICULTIES, BOT_PERSONALITIES } from './difficulty.js';

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const reverse = (a, b) => a[0] === -b[0] && a[1] === -b[1];

/** CPU player strategy with an explicit personality and bounded mistakes. */
export class BasicBot {
  constructor({ random, difficulty = 'normal', personality = 'cautious', name } = {}) {
    this.random = random;
    this.difficulty = BOT_DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.params = BOT_DIFFICULTIES[this.difficulty];
    this.personality = BOT_PERSONALITIES[personality] ? personality : 'cautious';
    this.profile = BOT_PERSONALITIES[this.personality];
    this.name = name || this.profile.name;
    this.stepsSinceTurn = 0;
    this.expeditionTarget = 0;
    this.targetTrailOwner = null;
    this.targetSinceTick = 0;
    this.attackReadyAt = 0;
  }

  nextDirection(player, game) {
    this.stepsSinceTurn++;
    const options = DIRECTIONS.filter(direction => !reverse(direction, [player.dx, player.dy]));
    if (!player.trailCells.length) {
      this.expeditionTarget = 3 + Math.floor(this.random() * this.params.expedition * this.profile.expeditionBias);
    }
    const returningHome = player.trailCells.length >= this.expeditionTarget;
    const observedTarget = this.findHuntTarget(player, game);
    if (observedTarget !== this.targetTrailOwner) {
      this.targetTrailOwner = observedTarget;
      this.targetSinceTick = game.tick;
    }
    const huntReady = this.personality === 'hunter' &&
      observedTarget != null &&
      game.tick - this.targetSinceTick >= (this.profile.targetDelayTicks || 3) &&
      game.tick >= this.attackReadyAt;

    const candidates = options.map(direction => {
      const nx = player.x + direction[0];
      const ny = player.y + direction[1];
      if (!game.grid.inside(nx, ny)) return { direction, score: -10000 };
      const index = game.grid.index(nx, ny);
      const owner = game.grid.owners[index];
      const trail = game.grid.trail[index];
      let score = this.random() * 1.2;
      const isHome = owner === player.id;
      if (isHome) score += player.trailCells.length ? 8 * this.profile.homeBias : 1;
      else score += player.trailCells.length < this.params.expedition * this.profile.expeditionBias ? 3 : -5;
      if (trail === player.id) score -= 10000;
      if (trail && trail !== player.id) {
        score += this.params.attack && huntReady && trail === observedTarget
          ? 2 + this.params.risk * 5 * this.profile.huntBias
          : -this.params.risk * 12;
      }
      if (owner && owner !== player.id && this.params.attack) score += this.params.risk * this.profile.huntBias;
      const distanceHome = player.homeX == null ? 0 : Math.abs(nx - player.homeX) + Math.abs(ny - player.homeY);
      if (player.trailCells.length && distanceHome > this.params.expedition) score -= returningHome ? 8 : 4;
      if (game.grid.territoryCount && game.grid.territoryCount(player.id) < 8 && isHome) score += 3;
      if (game.mode?.powerups && game.pickups?.length) {
        let nearestPickupDistance = Infinity;
        for (const pickup of game.pickups) {
          const distance = Math.abs(nx - pickup.x) + Math.abs(ny - pickup.y);
          if (distance <= this.params.vision && distance < nearestPickupDistance) nearestPickupDistance = distance;
        }
        if (nearestPickupDistance !== Infinity) score += Math.max(0, 5 - nearestPickupDistance * 0.65);
      }
      for (let step = 1; step <= this.params.vision; step++) {
        const x = nx + direction[0] * step;
        const y = ny + direction[1] * step;
        if (!game.grid.inside(x, y)) { score -= 3 / step; break; }
        const seen = game.grid.trail[game.grid.index(x, y)];
        if (seen && seen !== player.id) {
          score += this.params.attack && huntReady && seen === observedTarget
            ? this.params.risk * this.profile.huntBias
            : -this.params.risk * 10;
        }
      }
      return { direction, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    const valid = candidates.filter(candidate => candidate.score > -1000);
    if (!valid.length) return options[0] ?? [player.dx, player.dy];

    const mistakeChance = this.params.mistakeChance * this.profile.mistakeBias;
    if (valid.length > 1 && this.random() < mistakeChance) {
      const alternatives = valid.slice(1, Math.min(valid.length, 3));
      const mistake = alternatives[Math.floor(this.random() * alternatives.length)];
      if (mistake) return mistake.direction;
    }
    if (huntReady && observedTarget != null) this.attackReadyAt = game.tick + this.params.attackCooldownTicks;
    const poolSize = this.difficulty === 'hard' ? 2 : 3;
    const pool = valid.slice(0, poolSize);
    const selected = pool[Math.floor(this.random() * pool.length)];
    return selected?.direction ?? options[0] ?? [player.dx, player.dy];
  }

  findHuntTarget(player, game) {
    if (!this.params.attack || !this.profile.huntBias) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const other of game.players.values()) {
      if (!other.alive || other.id === player.id || !other.trailCells.length) continue;
      const distance = Math.abs(other.x - player.x) + Math.abs(other.y - player.y);
      if (distance <= this.params.vision + 2 && distance < bestDistance) {
        best = other.id;
        bestDistance = distance;
      }
    }
    return best;
  }
}
