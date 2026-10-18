import { BOT_DIFFICULTIES } from './difficulty.js';

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const reverse = (a, b) => a[0] === -b[0] && a[1] === -b[1];

/** CPU player strategy. Every decision returns one cardinal direction. */
export class BasicBot {
  /** @param {{random:()=>number,difficulty?:'easy'|'normal'|'hard'}} options */
  constructor({ random, difficulty = 'normal' }) {
    this.random = random;
    this.difficulty = BOT_DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.params = BOT_DIFFICULTIES[this.difficulty];
    this.stepsSinceTurn = 0;
    this.expeditionTarget = 0;
  }

  /** @param {object} player @param {{grid:object,players:object[]}} game */
  nextDirection(player, game) {
    this.stepsSinceTurn++;
    const options = DIRECTIONS.filter(direction => !reverse(direction, [player.dx, player.dy]));
    if (!player.trailCells.length) this.expeditionTarget = 3 + Math.floor(this.random() * this.params.expedition);
    const returningHome = player.trailCells.length >= this.expeditionTarget;\n    const candidates = options.map(direction => {
      const nx = player.x + direction[0];
      const ny = player.y + direction[1];
      if (!game.grid.inside(nx, ny)) return { direction, score: -10000 };
      const index = game.grid.index(nx, ny);
      const owner = game.grid.owners[index];
      const trail = game.grid.trail[index];
      let score = this.random() * 1.2;
      const isHome = owner === player.id;
      if (isHome) score += player.trailCells.length ? 8 : 1;
      else score += player.trailCells.length < this.params.expedition ? 3 : -5;
      if (trail === player.id) score -= 10000;
      if (trail && trail !== player.id) score += this.params.attack ? 2 + this.params.risk * 5 : -100;
      if (owner && owner !== player.id && this.params.attack) score += this.params.risk;
      const distanceHome = player.homeX == null ? 0 : Math.abs(nx - player.homeX) + Math.abs(ny - player.homeY);
      if (player.trailCells.length && distanceHome > this.params.expedition) score -= returningHome ? 8 : 4;
      if (game.grid.territoryCount && game.grid.territoryCount(player.id) < 8 && isHome) score += 3;
      for (let step = 1; step <= this.params.vision; step++) {
        const x = nx + direction[0] * step;
        const y = ny + direction[1] * step;
        if (!game.grid.inside(x, y)) { score -= 3 / step; break; }
        const seen = game.grid.trail[game.grid.index(x, y)];
        if (seen && seen !== player.id) score += this.params.attack ? this.params.risk : -this.params.risk * 10;
      }
      return { direction, score };
    });
    candidates.sort((a, b) => b.score - a.score);
    const poolSize = this.difficulty === 'hard' ? 2 : 3;
    const pool = candidates.slice(0, poolSize);
    const selected = pool[Math.floor(this.random() * pool.length)];
    return selected?.direction ?? options[0] ?? [player.dx, player.dy];
  }
}
