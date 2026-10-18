import { captureArea } from './fill.js';
import { bindInput } from './input.js';
import { Grid } from './Grid.js';
import { isReverseDirection } from './directions.js';
import { findTrailCollision } from './collisions.js';
import { GAME_CONFIG } from './config.js';
import { mulberry32 } from './random.js';
import { resolveHeadCollision, resolveTrailCrossing } from './rules.js';
import { BasicBot } from './bots/index.js';

const COLORS = {
  1: '#9b7bff', 2: '#ff6685', 3: '#ffbd59',
  4: '#42d9c0', 5: '#65a8ff', 6: '#f58bdf'
};
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Canvas game engine with fixed-step simulation and incremental territory scores. */
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
    this.sessionScore = 0;
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.effects = [];
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

  /** Starts a fresh round and resets session points. */
  reset() {
    if (!this.cellsWide || !this.cellsHigh) return;
    this.random = mulberry32(this.seed);
    this.effects = [];
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.grid = new Grid(this.cellsWide, this.cellsHigh);
    this.sessionScore = 0;
    const cx = Math.floor(this.cellsWide / 2);
    const cy = Math.floor(this.cellsHigh / 2);
    this.player = this.createPlayer(1, cx, cy, 1, 0, true);
    const spawns = Array.from({ length: GAME_CONFIG.botCount }, (_, index) => {
      const angle = (Math.PI * 2 * index) / GAME_CONFIG.botCount;
      const x = Math.round(this.cellsWide / 2 + Math.cos(angle) * this.cellsWide * .34);
      const y = Math.round(this.cellsHigh / 2 + Math.sin(angle) * this.cellsHigh * .34);
      const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
      const dx = horizontal ? -Math.sign(Math.cos(angle)) : 0;
      const dy = horizontal ? 0 : -Math.sign(Math.sin(angle));
      return [x, y, dx || (dy ? 0 : 1), dy];
    });
    this.bots = spawns.map((spawn, index) => {
      const bot = this.createPlayer(index + 2, spawn[0], spawn[1], spawn[2], spawn[3]);
      bot.homeX = bot.x;
      bot.homeY = bot.y;
      bot.strategy = new BasicBot({
        random: this.random,
        difficulty: ['easy', 'normal', 'hard'][index % 3]
      });
      return bot;
    });
    this.over = false;
    this.paused = false;
    this.accumulator = 0;
    this.moveAccumulator = 0;
    this.lastTime = 0;
    this.initializeTerritory(this.player, GAME_CONFIG.playerStartWidth, GAME_CONFIG.playerStartHeight);
    for (const bot of this.bots) this.initializeTerritory(bot, GAME_CONFIG.botStartWidth, GAME_CONFIG.botStartHeight);
    this.emitStats();
  }

  /** @returns {object} Mutable simulation state for one player. */
  createPlayer(id, x, y, dx, dy, human = false) {
    return {
      id, x, y, dx, dy, next: null, trailCells: [], alive: true,
      human, turnTimer: 0, respawnTimer: 0
    };
  }

  /** Paints a player's initial rectangle without stealing existing cells. */
  initializeTerritory(player, width, height) {
    const left = player.x - Math.floor(width / 2);
    const top = player.y - Math.floor(height / 2);
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        if (this.grid.inside(x, y) && !this.grid.ownerAt(x, y)) {
          this.grid.setOwner(x, y, player.id);
        }
      }
    }
  }

  /** Queues one legal turn for the next movement step. */
  queueDirection(dx, dy) {
    if (!this.running || this.paused || this.over || !this.player?.alive) return;
    const current = this.player;
    if (isReverseDirection([current.dx, current.dy], [dx, dy])) return;
    if (current.next && isReverseDirection(current.next, [dx, dy])) return;
    current.next = [dx, dy];
  }

  /** Pauses or resumes simulation without stopping rendering. */
  setPaused(paused) {
    this.paused = Boolean(paused);
    this.lastTime = 0;
    this.emitStats();
  }

  /** Restarts the round and clears session points. */
  restart() { this.reset(); }

  /** Accumulator loop: fixed updates and render on every animation frame. */
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

  /** Advances simulation by a fixed duration. */
  update(deltaMs) {
    this.moveAccumulator += deltaMs;
    while (this.moveAccumulator >= GAME_CONFIG.moveIntervalMs) {
      this.moveAccumulator -= GAME_CONFIG.moveIntervalMs;
      this.step();
      if (this.over) break;
    }
  }

  /** Advances respawn timers, then processes each active player. */
  step() {
    for (const player of [this.player, ...this.bots]) {
      if (player.alive) continue;
      player.respawnTimer--;
      if (player.respawnTimer <= 0) this.respawnPlayer(player);
    }
    this.movePlayer(this.player);
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

  /** Chooses a seeded direction other than a direct reversal. */
  randomDirection(current) {
    const options = DIRECTIONS.filter(([x, y]) => !(x === -current.dx && y === -current.dy));
    return options[Math.floor(this.random() * options.length)];
  }

  /** Resolves movement, trail crossings, head collisions, capture and territory loss. */
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

    const rivalHead = [this.player, ...this.bots].find(candidate =>
      candidate.id !== player.id && candidate.alive && candidate.x === nx && candidate.y === ny
    );
    if (rivalHead) {
      const losers = resolveHeadCollision(player, rivalHead);
      for (const loserId of losers) {
        const loser = [this.player, ...this.bots].find(candidate => candidate.id === loserId);
        if (loser?.alive) this.eliminatePlayer(loser, losers.length === 1 ? (loser.id === player.id ? rivalHead : player) : null);
      }
      if (!player.alive) return;
    }

    const trailOwnerId = this.grid.trail[nextIndex];
    if (trailOwnerId && trailOwnerId !== player.id) {
      const trailOwner = [this.player, ...this.bots].find(candidate => candidate.id === trailOwnerId);
      if (trailOwner?.alive) {
        const loserId = resolveTrailCrossing(player.id, trailOwnerId);
        const loser = [this.player, ...this.bots].find(candidate => candidate.id === loserId);
        if (loser) this.eliminatePlayer(loser, player);
      }
      if (!player.alive) return;
    }

    player.x = nx;
    player.y = ny;
    if (this.grid.ownerAt(nx, ny) === player.id) {
      if (player.trailCells.length) {
        const captured = captureArea(this.grid, player.id, player.trailCells);
        player.trailCells = [];
        if (player.human) this.sessionScore += captured;
        this.effects.push({type:'capture',x:player.x,y:player.y,started:performance.now(),duration:420});
        this.callbacks.onCapture?.(captured);
        this.checkTerritoryLoss();
      }
    } else {
      this.grid.trail[nextIndex] = player.id;
      player.trailCells.push(nextIndex);
    }
  }

  /** Eliminates a player, removes their territory, and schedules a respawn. */
  eliminatePlayer(player, killer = null) {
    if (!player.alive) return;
    player.alive = false;
    player.respawnTimer = player.human ? 0 : GAME_CONFIG.respawnSteps;
    this.effects.push({type:'death',x:player.x,y:player.y,started:performance.now(),duration:480,particles:Array.from({length:18},(_,i)=>({angle:Math.PI*2*i/18,speed:.6+(i%5)*.32}))});
    this.callbacks.onDeath?.(player.id,player.human);
    this.grid.clearTerritory(player.id);
    for (const index of player.trailCells) this.grid.trail[index] = 0;
    player.trailCells = [];
    player.next = null;
    if (killer?.human && !player.human) this.sessionScore += 100;
    if (!player.human) this.callbacks.onBotDown?.(player.id);
    if (player.human) {
      this.over = true;
      this.paused = true;
      const snapshot = this.getStats();
      this.callbacks.onGameOver?.(snapshot);
    }
    this.emitStats();
  }

  /** Checks the invariant that every live player owns at least one cell. */
  checkTerritoryLoss() {
    for (const player of [this.player, ...this.bots]) {
      if (player.alive && this.grid.territoryCount(player.id) === 0) {
        this.eliminatePlayer(player);
      }
    }
  }

  /** Respawns at the first free rectangle and grants a small safe territory. */
  respawnPlayer(player) {
    const width = player.human ? GAME_CONFIG.playerStartWidth : GAME_CONFIG.botStartWidth;
    const height = player.human ? GAME_CONFIG.playerStartHeight : GAME_CONFIG.botStartHeight;
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
    const [dx, dy] = this.randomDirection({ dx: player.dx, dy: player.dy });
    Object.assign(player, {
      x: spawn.x, y: spawn.y, dx, dy, next: null, trailCells: [],
      alive: true, respawnTimer: 0, turnTimer: 0
    });
    this.initializeTerritory(player, width, height);
  }

  /** Builds a HUD snapshot from incremental counters without scanning the map. */
  getStats() {
    const players = [this.player, ...this.bots];
    const top5 = players
      .map(player => ({ id: player.id, score: this.grid.territoryCount(player.id) }))
      .sort((a, b) => b.score - a.score || a.id - b.id)
      .slice(0, 5);
    const total = this.grid?.owners.length || 0;
    const score = this.grid?.territoryCount(1) || 0;
    return {
      territory: total ? Math.round(score / total * 100) : 0,
      score,
      sessionScore: this.sessionScore,
      bots: this.bots.filter(bot => bot.alive).length,
      respawning: !this.player?.alive,
      over: this.over,
      paused: this.paused,
      top5
    };
  }

  /** Publishes a compact snapshot at the configured HUD cadence. */
  emitStats() {
    this.lastStatsAt = performance.now();
    this.callbacks.onStats?.(this.getStats());
  }

  /** Draws the world with a smooth player camera and short-lived feedback effects. */
  draw() {
    if (!this.ctx || !this.grid) return;
    const {width,height}=this.canvas.getBoundingClientRect();
    if(!width||!height)return;
    const ctx=this.ctx,cellW=width/this.cellsWide,cellH=height/this.cellsHigh;
    const targetX=this.player?.alive?this.player.x*cellW:width/2;
    const targetY=this.player?.alive?this.player.y*cellH:height/2;
    const territory=this.grid.territoryCount(1)/Math.max(1,this.grid.owners.length);
    const targetZoom=Math.max(.84,Math.min(1.12,1.08-territory*.9));
    if(!this.camera.x&&!this.camera.y){this.camera.x=targetX;this.camera.y=targetY;}
    this.camera.x+=(targetX-this.camera.x)*.16;
    this.camera.y+=(targetY-this.camera.y)*.16;
    this.camera.zoom+=(targetZoom-this.camera.zoom)*.045;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.fillStyle='#10131c';ctx.fillRect(0,0,width,height);
    ctx.save();
    ctx.translate(width/2-this.camera.x*this.camera.zoom,height/2-this.camera.y*this.camera.zoom);
    ctx.scale(this.camera.zoom,this.camera.zoom);
    for(let y=0;y<this.cellsHigh;y++)for(let x=0;x<this.cellsWide;x++){
      const index=this.grid.index(x,y),owner=this.grid.owners[index],trail=this.grid.trail[index];
      if(!owner&&!trail)continue;
      const id=trail||owner,px=x*cellW,py=y*cellH;
      const palette=['#9b7bff','#ff6685','#ffbd59','#42d9c0','#65a8ff','#f58bdf','#a6e36f','#ff8d5e','#7de0ff','#e4dc6a','#c4a1ff'];
      ctx.fillStyle=COLORS[id]||palette[(id-1)%palette.length];ctx.globalAlpha=trail?.98:.72;
      ctx.fillRect(px+.6,py+.6,Math.max(1,cellW-1.2),Math.max(1,cellH-1.2));
      if(id!==1&&!trail){ctx.globalAlpha=.25;ctx.strokeStyle='#10131c';ctx.lineWidth=1;
        if(id%3===0){ctx.beginPath();ctx.moveTo(px+2,py+2);ctx.lineTo(px+cellW-2,py+cellH-2);ctx.stroke();}
        else if(id%3===1){ctx.beginPath();ctx.arc(px+cellW/2,py+cellH/2,Math.max(1,cellW*.18),0,Math.PI*2);ctx.stroke();}
        else ctx.strokeRect(px+cellW*.28,py+cellH*.28,cellW*.44,cellH*.44);
      }
    }
    ctx.globalAlpha=1;this.drawPlayer(ctx,this.player,cellW,cellH);
    for(const bot of this.bots)if(bot.alive)this.drawPlayer(ctx,bot,cellW,cellH);
    const now=performance.now();this.effects=this.effects.filter(effect=>now-effect.started<effect.duration);
    for(const effect of this.effects){
      const progress=(now-effect.started)/effect.duration,cx=(effect.x+.5)*cellW,cy=(effect.y+.5)*cellH;
      if(effect.type==='capture'){ctx.strokeStyle='#fff';ctx.globalAlpha=(1-progress)*.85;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(cx,cy,2+progress*cellW*5,0,Math.PI*2);ctx.stroke();}
      else for(const particle of effect.particles){const distance=progress*cellW*particle.speed*8;ctx.globalAlpha=1-progress;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx+Math.cos(particle.angle)*distance,cy+Math.sin(particle.angle)*distance,Math.max(1,cellW*.13*(1-progress)),0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;ctx.restore();
  }

  /** Draws a player marker. */
  drawPlayer(ctx, player, cellW, cellH) {
    if (!player?.alive) return;
    const palette = ['#9b7bff', '#ff6685', '#ffbd59', '#42d9c0', '#65a8ff', '#f58bdf', '#a6e36f', '#ff8d5e', '#7de0ff', '#e4dc6a', '#c4a1ff'];
    const color = COLORS[player.id] || palette[(player.id - 1) % palette.length];
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(player.x * cellW + 1, player.y * cellH + 1, Math.max(2, cellW - 2), Math.max(2, cellH - 2));
    this.ctx.fillStyle = color;
    this.ctx.fillRect(player.x * cellW + 2, player.y * cellH + 2, Math.max(1, cellW - 4), Math.max(1, cellH - 4));
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
