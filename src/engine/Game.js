import { bindInput } from './input.js';
import { GAME_CONFIG } from './config.js';
import { getSkinById } from './skins.js';
import { getPlayerColor } from './playerPalette.js';
import { Simulation } from './Simulation.js';

/** Browser adapter: animation loop, input, camera and canvas rendering only. */
export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.simulation = new Simulation({ seed: callbacks.seed ?? GAME_CONFIG.seed });
    this.running = true;
    this.frame = 0;
    this.lastTime = 0;
    this.accumulator = 0;
    this.lastStatsAt = 0;
    this.dpr = 1;
    this.camera = { x: this.player?.x ?? 0, y: this.player?.y ?? 0, zoom: 1 };
    this.effects = [];
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.terrainDirty = true;
    this.cachedSkinId = null;

    this.unsubscribeEvents = [
      this.simulation.events.on('capture', event => {
        this.effects.push({ type: 'capture', x: event.x, y: event.y, started: performance.now(), duration: 420 });
        this.callbacks.onCapture?.(event.captured);
      }),
      this.simulation.events.on('death', event => {
        this.effects.push({
          type: 'death', x: this.players.get(event.playerId)?.x ?? 0, y: this.players.get(event.playerId)?.y ?? 0,
          started: performance.now(), duration: 480,
          particles: Array.from({ length: 18 }, (_, i) => ({
            angle: Math.PI * 2 * i / 18, speed: 0.6 + (i % 5) * 0.32
          }))
        });
        this.callbacks.onDeath?.(event.playerId, event.human);
      }),
      this.simulation.events.on('kill', event => {
        if (event.victimId !== 1) this.callbacks.onBotDown?.(event.victimId, event.killerHuman);
      }),
      this.simulation.events.on('gameOver', snapshot => this.callbacks.onGameOver?.(snapshot))
    ];

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.unbindInput = bindInput(canvas, this);
    this.onVisibility = () => { this.lastTime = 0; };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.emitStats();
    this.frame = requestAnimationFrame(time => this.loop(time));
  }

  get grid() { return this.simulation.grid; }
  get players() { return this.simulation.players; }
  get player() { return this.simulation.player; }
  get bots() { return this.simulation.bots; }
  get cellsWide() { return this.simulation.cellsWide; }
  get cellsHigh() { return this.simulation.cellsHigh; }
  get sessionScore() { return this.simulation.sessionScore; }
  get over() { return this.simulation.over; }
  get paused() { return this.simulation.paused; }

  resize() {
    if (!this.running) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.terrainDirty = true;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  queueDirection(dx, dy) {
    this.simulation.queueDirection(dx, dy);
  }

  setPaused(paused) {
    this.simulation.setPaused(paused);
    this.lastTime = 0;
    this.emitStats();
  }

  restart() {
    this.simulation.reset();
    this.effects = [];
    this.camera = { x: this.player?.x ?? 0, y: this.player?.y ?? 0, zoom: 1 };
    this.terrainDirty = true;
    this.accumulator = 0;
    this.lastTime = 0;
    this.emitStats();
  }

  reset() { this.restart(); }

  loop(time) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = time;
    const delta = Math.min(time - this.lastTime, GAME_CONFIG.maxFrameDeltaMs);
    this.lastTime = time;
    if (!this.paused && !this.over) {
      this.accumulator += delta;
      while (this.accumulator >= GAME_CONFIG.fixedStepMs) {
        this.simulation.update(GAME_CONFIG.fixedStepMs);
        this.accumulator -= GAME_CONFIG.fixedStepMs;
        if (this.over) break;
      }
    }
    this.draw();
    if (time - this.lastStatsAt >= GAME_CONFIG.statsIntervalMs) this.emitStats();
    this.frame = requestAnimationFrame(next => this.loop(next));
  }

  update(deltaMs) { this.simulation.update(deltaMs); }
  step() { this.simulation.step(); }
  getStats() { return this.simulation.getStats(); }

  emitStats() {
    this.lastStatsAt = performance.now();
    this.callbacks.onStats?.(this.getStats());
  }

  draw() {
    if (!this.ctx || !this.grid) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;

    const cellSize = Math.min(width, height) / 27;
    const targetX = this.player?.alive ? this.player.x : this.cellsWide / 2;
    const targetY = this.player?.alive ? this.player.y : this.cellsHigh / 2;
    const territory = this.grid.territoryCount(1) / Math.max(1, this.grid.owners.length);
    const viewportRatio = Math.min(width, height) / Math.max(width, height);
    const viewportZoom = Math.max(0.9, Math.min(1.08, 0.9 + viewportRatio * 0.18));
    const targetZoom = Math.max(0.9, Math.min(1.08, viewportZoom * (1 - territory * 0.18)));

    this.camera.x += (targetX - this.camera.x) * 0.16;
    this.camera.y += (targetY - this.camera.y) * 0.16;
    this.camera.zoom += (targetZoom - this.camera.zoom) * 0.045;

    const visibleWidth = width / (cellSize * this.camera.zoom);
    const visibleHeight = height / (cellSize * this.camera.zoom);
    this.camera.x = visibleWidth >= this.cellsWide
      ? this.cellsWide / 2
      : Math.max(visibleWidth / 2, Math.min(this.cellsWide - visibleWidth / 2, this.camera.x));
    this.camera.y = visibleHeight >= this.cellsHigh
      ? this.cellsHigh / 2
      : Math.max(visibleHeight / 2, Math.min(this.cellsHigh - visibleHeight / 2, this.camera.y));

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#10131c';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(
      width / 2 - this.camera.x * cellSize * this.camera.zoom,
      height / 2 - this.camera.y * cellSize * this.camera.zoom
    );
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const skinId = this.callbacks.getSkin?.() || 'classic';
    const skin = getSkinById(skinId);
    if (this.cachedSkinId !== skinId) {
      this.cachedSkinId = skinId;
      this.terrainDirty = true;
    }

    this.renderTerrain(cellSize, skin);
    this.renderPlayers(ctx, cellSize, skin);
    this.renderEffects(ctx, cellSize);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderTerrain(cellSize, skin) {
    const width = Math.ceil(this.cellsWide * cellSize);
    const height = Math.ceil(this.cellsHigh * cellSize);
    if (this.terrainCanvas.width !== width || this.terrainCanvas.height !== height) {
      this.terrainCanvas.width = width;
      this.terrainCanvas.height = height;
      this.terrainDirty = true;
    }
    if (!this.terrainDirty) {
      this.ctx.drawImage(this.terrainCanvas, 0, 0);
      return;
    }

    const layer = this.terrainCtx;
    layer.clearRect(0, 0, width, height);
    for (let y = 0; y < this.cellsHigh; y++) {
      for (let x = 0; x < this.cellsWide; x++) {
        const index = this.grid.index(x, y);
        const owner = this.grid.owners[index];
        const trail = this.grid.trail[index];
        if (!owner && !trail) continue;

        const id = trail || owner;
        const px = x * cellSize;
        const py = y * cellSize;
        layer.fillStyle = id === 1 ? skin.color : getPlayerColor(id);
        layer.globalAlpha = trail ? 0.98 : 0.72;

        if (id === 1 && trail && skin.trailShape === 'circle') {
          layer.beginPath();
          layer.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.43, 0, Math.PI * 2);
          layer.fill();
        } else if (id === 1 && trail && skin.trailShape === 'diamond') {
          layer.beginPath();
          layer.moveTo(px + cellSize / 2, py + 1);
          layer.lineTo(px + cellSize - 1, py + cellSize / 2);
          layer.lineTo(px + cellSize / 2, py + cellSize - 1);
          layer.lineTo(px + 1, py + cellSize / 2);
          layer.closePath();
          layer.fill();
        } else {
          layer.fillRect(px + 0.6, py + 0.6, Math.max(1, cellSize - 1.2), Math.max(1, cellSize - 1.2));
        }

        if (id === 1 && skin.pattern !== 'solid') {
          layer.globalAlpha = 0.35;
          layer.strokeStyle = '#fff';
          layer.lineWidth = 1;
          if (skin.pattern === 'dots') {
            layer.beginPath();
            layer.arc(px + cellSize / 2, py + cellSize / 2, Math.max(1, cellSize * 0.15), 0, Math.PI * 2);
            layer.stroke();
          } else if (skin.pattern === 'stripes') {
            layer.beginPath();
            layer.moveTo(px + 1, py + cellSize - 1);
            layer.lineTo(px + cellSize - 1, py + 1);
            layer.stroke();
          } else if (skin.pattern === 'grid') {
            layer.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
          } else if (skin.pattern === 'rings') {
            layer.beginPath();
            layer.arc(px + cellSize / 2, py + cellSize / 2, cellSize * 0.25, 0, Math.PI * 2);
            layer.stroke();
          }
        }

        if (id !== 1 && !trail) {
          layer.globalAlpha = 0.25;
          layer.strokeStyle = '#10131c';
          layer.lineWidth = 1;
          if (id % 3 === 0) {
            layer.beginPath();
            layer.moveTo(px + 2, py + 2);
            layer.lineTo(px + cellSize - 2, py + cellSize - 2);
            layer.stroke();
          } else if (id % 3 === 1) {
            layer.beginPath();
            layer.arc(px + cellSize / 2, py + cellSize / 2, Math.max(1, cellSize * 0.18), 0, Math.PI * 2);
            layer.stroke();
          } else {
            layer.strokeRect(px + cellSize * 0.28, py + cellSize * 0.28, cellSize * 0.44, cellSize * 0.44);
          }
        }
      }
    }
    layer.globalAlpha = 1;
    this.terrainDirty = false;
    this.ctx.drawImage(this.terrainCanvas, 0, 0);
  }

  renderPlayers(ctx, cellSize, skin) {
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const color = player.id === 1 ? skin.color : getPlayerColor(player.id);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.x * cellSize + 1, player.y * cellSize + 1, Math.max(2, cellSize - 2), Math.max(2, cellSize - 2));
      ctx.fillStyle = color;
      ctx.fillRect(player.x * cellSize + 2, player.y * cellSize + 2, Math.max(1, cellSize - 4), Math.max(1, cellSize - 4));
    }
  }

  renderEffects(ctx, cellSize) {
    const now = performance.now();
    this.effects = this.effects.filter(effect => now - effect.started < effect.duration);
    for (const effect of this.effects) {
      const progress = (now - effect.started) / effect.duration;
      const cx = (effect.x + 0.5) * cellSize;
      const cy = (effect.y + 0.5) * cellSize;
      if (effect.type === 'capture') {
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = (1 - progress) * 0.85;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 2 + progress * cellSize * 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        for (const particle of effect.particles ?? []) {
          const distance = progress * cellSize * particle.speed * 8;
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(
            cx + Math.cos(particle.angle) * distance,
            cy + Math.sin(particle.angle) * distance,
            Math.max(1, cellSize * 0.13 * (1 - progress)),
            0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  destroy() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.unbindInput?.();
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const unsubscribe of this.unsubscribeEvents) unsubscribe();
    this.callbacks = {};
  }
}
