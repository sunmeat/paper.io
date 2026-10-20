import { bindInput } from './input.js';
import { GAME_CONFIG } from './config.js';
import { getSkinById, getHatById, getTrailById } from './skins.js';
import { getPlayerColor } from './playerPalette.js';
import { Simulation } from './Simulation.js';

/** Browser adapter: animation loop, input, camera and canvas rendering only. */
export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    const progress = this.readBotProgress();
    this.simulation = new Simulation({
      seed: callbacks.seed ?? GAME_CONFIG.seed,
      mapId: callbacks.mapId ?? 'circle',
      modeId: callbacks.modeId ?? 'classic',
      config: { ...(callbacks.countryLevel ? { botCount: Math.min(18, 9 + callbacks.countryLevel - 1) } : {}), ...(callbacks.config || {}) },
      humanPlayer: !callbacks.observer,
      playerLevel: Math.max(progress.playerLevel, callbacks.playerLevel || 1, callbacks.countryLevel || 1),
      winStreak: progress.winStreak,
      lossStreak: progress.lossStreak
    });
    this.running = true;
    this.frame = 0;
    this.lastTime = 0;
    this.frameDeltaMs = 0;
    this.renderAngles = new Map();
    this.accumulator = 0;
    this.lastStatsAt = 0;
    this.countdownEndAt = performance.now() + 3000;
    this.countdownFinished = false;
    this.startedAt = this.countdownEndAt;
    this.dpr = 1;
    this.camera = { x: this.player?.x ?? 0, y: this.player?.y ?? 0, zoom: 1 };
    this.effects = [];
    this.effectPool = [];
    this.particlePool = [];
    this.cameraShake = 0;
    this.qualityLevel = 2;
    this.fpsWindowStarted = performance.now();
    this.fpsFrames = 0;
    this.measuredFps = 60;
    this.renderMetrics = { fullTerrainRedraws: 0, incrementalTerrainRedraws: 0, cellsRedrawn: 0 };
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskDirty = true;
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.terrainDirty = true;
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = this.cellsWide;
    this.minimapCanvas.height = this.cellsHigh;
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapVersion = -1;
    this.cachedSkinId = null;
    this.cachedOwnerVersion = -1;

    this.unsubscribeEvents = [
      this.simulation.events.on('leaderChange', event => {
        window.dispatchEvent(new CustomEvent('paperio:leader-change', { detail: event }));
      }),
      this.simulation.events.on('capture', event => {
        if (event.human) this.recordBotProgressAfterCapture(event.captured);
        this.addEffect({ type: 'capture', x: event.x, y: event.y, started: performance.now(), duration: 620 });
      }),
      this.simulation.events.on('death', event => {
        if (event.human) this.recordBotProgressAfterLoss();
        this.cameraShake = Math.max(this.cameraShake, event.human ? 9 : 3);
        this.addEffect({
          type: 'death', x: this.players.get(event.playerId)?.x ?? 0, y: this.players.get(event.playerId)?.y ?? 0,
          started: performance.now(), duration: 480,
          particles: this.createParticles(18)
        });
      }),
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

  recordBotProgressAfterCapture(captured) {
    try {
      const total = Math.max(0, Number(localStorage.getItem('paper-io-total-captured')) || 0) + Math.max(0, captured || 0);
      localStorage.setItem('paper-io-total-captured', String(total));
      localStorage.setItem('paper-io-player-level', String(Math.max(1, 1 + Math.floor(total / 100))));
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }

  recordBotProgressAfterLoss() {
    try {
      const lossStreak = Math.max(0, Number(localStorage.getItem('paper-io-loss-streak')) || 0);
      localStorage.setItem('paper-io-win-streak', '0');
      localStorage.setItem('paper-io-loss-streak', String(lossStreak + 1));
    } catch {
      // Storage can be unavailable in private browsing contexts.
    }
  }

  readBotProgress() {
    try {
      const read = (key, fallback = 0) => {
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) && value >= 0 ? value : fallback;
      };
      return { playerLevel: Math.max(1, read('paper-io-player-level', 1)), winStreak: read('paper-io-win-streak'), lossStreak: read('paper-io-loss-streak') };
    } catch {
      return { playerLevel: 1, winStreak: 0, lossStreak: 0 };
    }
  }

  get grid() { return this.simulation.grid; }
  get leaderId() { return this.simulation.leaderId; }
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
    this.maskDirty = true;
    this.minimapVersion = -1;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  queueDirection(dx, dy) {
    if (!this.countdownFinished) return false;
    return this.simulation.queueDirection(dx, dy);
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
    this.maskDirty = true;
    this.minimapVersion = -1;
    this.accumulator = 0;
    this.lastTime = 0;
    this.countdownEndAt = performance.now() + 3000;
    this.countdownFinished = false;
    this.startedAt = this.countdownEndAt;
    this.emitStats();
  }

  reset() { this.restart(); }

  loop(time) {
    if (!this.running) return;
    const inCountdown = time < this.countdownEndAt;
    let delta = 0;
    if (inCountdown) {
      this.lastTime = time;
      this.accumulator = 0;
    } else if (!this.countdownFinished) {
      this.countdownFinished = true;
      this.startedAt = time;
      this.lastTime = time;
      this.accumulator = 0;
    } else {
      if (!this.lastTime) this.lastTime = time;
      delta = Math.min(time - this.lastTime, GAME_CONFIG.maxFrameDeltaMs);
      this.lastTime = time;
    }
    this.frameDeltaMs = delta;
    if (!inCountdown && !this.paused && !this.over) {
      this.accumulator += delta;
      while (this.accumulator >= GAME_CONFIG.fixedStepMs) {
        this.simulation.update(GAME_CONFIG.fixedStepMs);
        this.accumulator -= GAME_CONFIG.fixedStepMs;
        if (this.over) break;
      }
    }
    this.draw();
    this.measureRenderPerformance(time);
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
    const interpolation = Math.max(0, Math.min(1, this.simulation.moveAccumulator / this.simulation.config.moveIntervalMs));
    const playerX = this.player ? this.player.prevX + (this.player.x - this.player.prevX) * interpolation : this.cellsWide / 2;
    const playerY = this.player ? this.player.prevY + (this.player.y - this.player.prevY) * interpolation : this.cellsHigh / 2;
    const targetX = this.player?.alive ? playerX + 0.5 : this.cellsWide / 2;
    const targetY = this.player?.alive ? playerY + 0.5 : this.cellsHigh / 2;
    const territory = this.grid.territoryCount(1) / Math.max(1, this.grid.owners.length);
    const viewportRatio = Math.min(width, height) / Math.max(width, height);
    const viewportZoom = Math.max(0.9, Math.min(1.08, 0.9 + viewportRatio * 0.18));
    const targetZoom = Math.max(0.9, Math.min(1.08, viewportZoom * (1 - territory * 0.18)));

    const cameraAlpha = 1 - Math.exp(-(this.frameDeltaMs || 1000 / 60) / 1000 * 8);
    this.camera.x += (targetX - this.camera.x) * cameraAlpha;
    this.camera.y += (targetY - this.camera.y) * cameraAlpha;
    this.camera.zoom += (targetZoom - this.camera.zoom) * (1 - Math.exp(-(this.frameDeltaMs || 1000 / 60) / 1000 * 2.8));

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
    const shakeX = this.cameraShake > 0.15 ? (Math.random() - 0.5) * this.cameraShake : 0;
    const shakeY = this.cameraShake > 0.15 ? (Math.random() - 0.5) * this.cameraShake : 0;
    this.cameraShake *= 0.82;
    ctx.translate(
      width / 2 - this.camera.x * cellSize * this.camera.zoom + shakeX,
      height / 2 - this.camera.y * cellSize * this.camera.zoom + shakeY
    );
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const skinId = this.callbacks.getSkin?.() || 'classic';
    const skin = getSkinById(skinId);
    if (this.cachedSkinId !== skinId) {
      this.cachedSkinId = skinId;
      this.terrainDirty = true;
      this.minimapVersion = -1;
    }

    this.renderTerrain(cellSize, skin);
    this.renderTrail(ctx, cellSize, interpolation, skin);
    this.renderPlayers(ctx, cellSize, skin, interpolation);
    this.renderEffects(ctx, cellSize);
    ctx.globalAlpha = 1;
    ctx.restore();
    this.renderCountdown(width, height);
  }

  renderTerrain(cellSize, skin) {
    const width = Math.ceil(this.cellsWide * cellSize);
    const height = Math.ceil(this.cellsHigh * cellSize);
    if (this.maskCanvas.width !== width || this.maskCanvas.height !== height) {
      this.maskCanvas.width = width; this.maskCanvas.height = height; this.maskDirty = true;
    }
    if (this.terrainCanvas.width !== width || this.terrainCanvas.height !== height) {
      this.terrainCanvas.width = width; this.terrainCanvas.height = height; this.terrainDirty = true;
    }

    // Static walkable background and arena outline are cached independently of ownership.
    if (this.maskDirty) {
      const layer = this.maskCtx;
      layer.clearRect(0, 0, width, height);
      layer.fillStyle = '#10131c'; layer.fillRect(0, 0, width, height);
      layer.fillStyle = '#171b28';
      for (let y = 0; y < this.cellsHigh; y++) for (let x = 0; x < this.cellsWide; x++) {
        if (this.grid.walkable[this.grid.index(x, y)]) layer.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
      layer.strokeStyle = '#aeb9d8'; layer.lineWidth = Math.max(1.5, cellSize * 0.1); layer.beginPath();
      for (let y = 0; y < this.cellsHigh; y++) for (let x = 0; x < this.cellsWide; x++) {
        if (!this.grid.walkable[this.grid.index(x, y)]) continue;
        const px = x * cellSize, py = y * cellSize;
        if (!this.grid.inside(x, y - 1)) { layer.moveTo(px, py); layer.lineTo(px + cellSize, py); }
        if (!this.grid.inside(x + 1, y)) { layer.moveTo(px + cellSize, py); layer.lineTo(px + cellSize, py + cellSize); }
        if (!this.grid.inside(x, y + 1)) { layer.moveTo(px + cellSize, py + cellSize); layer.lineTo(px, py + cellSize); }
        if (!this.grid.inside(x - 1, y)) { layer.moveTo(px, py + cellSize); layer.lineTo(px, py); }
      }
      layer.stroke(); this.maskDirty = false; this.terrainDirty = true;
    }

    const skinId = this.callbacks.getSkin?.() || 'classic';
    const fullRedraw = this.terrainDirty || this.cachedSkinId !== skinId;
    const changed = this.grid.drainDirtyOwners();
    if (fullRedraw) {
      const layer = this.terrainCtx;
      layer.clearRect(0, 0, width, height);
      const all = this.grid.owners.keys();
      this.paintOwnerCells(layer, cellSize, skin, all);
      const cells = Array.from(this.grid.owners.keys());
      this.renderSkinPattern(layer, cellSize, skin, cells);
      this.renderTerritoryEdges(layer, cellSize, cells);
      this.terrainDirty = false;
      this.cachedOwnerVersion = this.grid.ownerVersion;
      this.cachedSkinId = skinId;
      this.renderMetrics.fullTerrainRedraws++;
    } else if (changed.length) {
      // Dirty cells plus their neighbours refresh rounded joins and shared borders.
      const dirty = new Set();
      for (const index of changed) {
        const x = index % this.cellsWide, y = Math.floor(index / this.cellsWide);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if (this.grid.inBounds(nx, ny)) dirty.add(this.grid.index(nx, ny));
        }
      }
      const cells = [...dirty];
      const layer = this.terrainCtx;
      for (const index of cells) {
        const x = index % this.cellsWide, y = Math.floor(index / this.cellsWide);
        layer.clearRect(x * cellSize - 1, y * cellSize - 1, cellSize + 2, cellSize + 2);
      }
      this.paintOwnerCells(layer, cellSize, skin, cells);
      this.renderSkinPattern(layer, cellSize, skin, cells);
      this.renderTerritoryEdges(layer, cellSize, cells);
      this.cachedOwnerVersion = this.grid.ownerVersion;
      this.renderMetrics.incrementalTerrainRedraws++;
      this.renderMetrics.cellsRedrawn += cells.length;
    }

    this.ctx.drawImage(this.maskCanvas, 0, 0);
    this.ctx.drawImage(this.terrainCanvas, 0, 0);
  }

  paintOwnerCells(ctx, cellSize, skin, indices) {
    for (const index of indices) {
      const owner = this.grid.owners[index];
      if (!owner || !this.grid.walkable[index]) continue;
      const x = index % this.cellsWide, y = Math.floor(index / this.cellsWide);
      const px = x * cellSize, py = y * cellSize;
      const color = owner === 1 ? skin.color : getPlayerColor(owner, skin.color);
      // Adjacent cells blend into one continuous territory instead of a tiled patchwork.
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(px - 0.35, py - 0.35, cellSize + 0.7, cellSize + 0.7);
    }
    ctx.globalAlpha = 1;
  }

  renderSkinPattern(ctx, cellSize, skin, indices = null) {
    if (skin.pattern === 'solid' || cellSize < 5 || this.qualityLevel === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = skin.color;
    ctx.fillStyle = skin.color;
    ctx.lineWidth = Math.max(0.6, cellSize * 0.045);
    for (const index of (indices || this.grid.owners.keys())) {
      if (this.grid.owners[index] !== 1 || !this.grid.walkable[index]) continue;
      const x = (index % this.cellsWide) * cellSize;
      const y = Math.floor(index / this.cellsWide) * cellSize;
      const inset = cellSize * 0.24;
      if (skin.pattern === 'dots' || skin.pattern === 'stars') {
        ctx.beginPath(); ctx.arc(x + cellSize / 2, y + cellSize / 2, Math.max(0.5, cellSize * 0.055), 0, Math.PI * 2); ctx.fill();
      } else if (skin.pattern === 'grid') {
        ctx.strokeRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
      } else if (skin.pattern === 'rings') {
        ctx.beginPath(); ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.18, 0, Math.PI * 2); ctx.stroke();
      } else if (skin.pattern === 'pixels') {
        ctx.fillRect(x + cellSize * 0.58, y + cellSize * 0.24, cellSize * 0.16, cellSize * 0.16);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + inset, y + cellSize - inset);
        ctx.lineTo(x + cellSize - inset, y + inset);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  renderTerritoryEdges(ctx, cellSize, indices = null) {
    ctx.save();
    ctx.strokeStyle = '#10131c';
    ctx.lineWidth = Math.max(0.7, cellSize * 0.055);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const index of (indices || this.grid.owners.keys())) {
      const x = index % this.cellsWide, y = Math.floor(index / this.cellsWide);
      if (!this.grid.walkable[index]) continue;
      const owner = this.grid.owners[index];
      const px = x * cellSize, py = y * cellSize;
      if (x === 0 || this.grid.owners[index - 1] !== owner || !this.grid.walkable[index - 1]) { ctx.moveTo(px, py); ctx.lineTo(px, py + cellSize); }
      if (x === this.cellsWide - 1 || this.grid.owners[index + 1] !== owner || !this.grid.walkable[index + 1]) { ctx.moveTo(px + cellSize, py); ctx.lineTo(px + cellSize, py + cellSize); }
      if (y === 0 || this.grid.owners[index - this.cellsWide] !== owner || !this.grid.walkable[index - this.cellsWide]) { ctx.moveTo(px, py); ctx.lineTo(px + cellSize, py); }
      if (y === this.cellsHigh - 1 || this.grid.owners[index + this.cellsWide] !== owner || !this.grid.walkable[index + this.cellsWide]) { ctx.moveTo(px, py + cellSize); ctx.lineTo(px + cellSize, py + cellSize); }
    }
    ctx.stroke();
    ctx.restore();
  }

  renderMinimap(width, height, skin) {
    if (this.minimapVersion !== this.grid.version) {
      const image = this.minimapCtx.createImageData(this.cellsWide, this.cellsHigh);
      const toRgb = id => {
        const hex = (id === 1 ? skin.color : getPlayerColor(id, skin.color)).replace('#', '');
        return [parseInt(hex.slice(0, 2), 16) || 0, parseInt(hex.slice(2, 4), 16) || 0, parseInt(hex.slice(4, 6), 16) || 0];
      };
      const palette = new Map();
      for (const player of this.players.values()) palette.set(player.id, toRgb(player.id));
      for (let i = 0; i < this.grid.walkable.length; i++) {
        if (!this.grid.walkable[i]) continue;
        const o = i * 4, id = this.grid.trail[i] || this.grid.owners[i];
        const c = id ? (palette.get(id) || [160, 160, 180]) : [35, 40, 54];
        image.data[o] = c[0]; image.data[o + 1] = c[1]; image.data[o + 2] = c[2]; image.data[o + 3] = 255;
      }
      this.minimapCtx.putImageData(image, 0, 0); this.minimapVersion = this.grid.version;
    }
    const ctx = this.ctx, size = Math.min(154, Math.max(100, Math.min(width, height) * 0.25));
    const x = width - size - 14, y = 68, mapHeight = size * this.cellsHigh / this.cellsWide;
    ctx.save(); ctx.fillStyle = '#0b0e17'; ctx.fillRect(x - 5, y - 5, size + 10, mapHeight + 10);
    ctx.strokeStyle = '#7883a7'; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 5, size + 10, mapHeight + 10);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(this.minimapCanvas, x, y, size, mapHeight);
    ctx.font = '9px monospace'; ctx.textBaseline = 'middle';
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      const px = x + (player.x + 0.5) * size / this.cellsWide, py = y + (player.y + 0.5) * mapHeight / this.cellsHigh;
      ctx.fillStyle = player.id === 1 ? skin.color : getPlayerColor(player.id, skin.color);
      ctx.beginPath(); ctx.arc(px, py, player.id === 1 ? 3.2 : 2.1, 0, Math.PI * 2); ctx.fill();
      if (player.id !== 1) { ctx.fillStyle = '#f3f4fa'; ctx.fillText(player.x + ',' + player.y, Math.min(x + size - 26, px + 3), py - 4); }
    }
    ctx.restore();
  }

  renderTrail(ctx, cellSize, interpolation, skin) {
    const trailEffect = getTrailById(this.callbacks.getTrail?.() || 'none');
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // A full-cell stroke makes the exposed trail visually join the filled territory.
    ctx.lineWidth = cellSize * (1.02 + (Math.sin(performance.now() / 115) + 1) * 0.015);
    for (const player of this.players.values()) {
      if (!player.alive || !player.trailCells.length) continue;
      const points = player.trailCells.filter(index => this.grid.trail[index] === player.id).map(index => ({
        x: (index % this.cellsWide + 0.5) * cellSize,
        y: (Math.floor(index / this.cellsWide) + 0.5) * cellSize
      }));
      if (!points.length) continue;
      if (points.length > 0) {
        const last = points.length - 1;
        points[last] = {
          x: (player.prevX + (player.x - player.prevX) * interpolation + 0.5) * cellSize,
          y: (player.prevY + (player.y - player.prevY) * interpolation + 0.5) * cellSize
        };
      }
      if (points.length > 1) {
        const dx = (points[1].x - points[0].x) * 0.5;
        const dy = (points[1].y - points[0].y) * 0.5;
        points[0] = { x: points[0].x - dx, y: points[0].y - dy };
      } else {
        points[0] = {
          x: points[0].x - player.dx * cellSize * 0.5,
          y: points[0].y - player.dy * cellSize * 0.5
        };
      }
      ctx.strokeStyle = player.id === 1 ? skin.color : getPlayerColor(player.id, skin.color);
      ctx.fillStyle = ctx.strokeStyle;
      if (player.human && trailEffect.id === 'glow') { ctx.shadowColor = trailEffect.color; ctx.shadowBlur = cellSize * 0.7; }
      else if (player.human && trailEffect.id === 'comet') { ctx.shadowColor = trailEffect.color; ctx.shadowBlur = cellSize * 1.2; }
      else { ctx.shadowBlur = 0; }
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y);
      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        if (player.human && trailEffect.id === 'spark') { ctx.shadowBlur = 0; ctx.fillStyle = trailEffect.color; ctx.fillRect(points[0].x - cellSize * 0.14, points[0].y - cellSize * 0.14, cellSize * 0.28, cellSize * 0.28); }
      } else {
        ctx.stroke();
        const head = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(head.x, head.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        if (player.human && trailEffect.id === 'spark') { ctx.shadowBlur = 0; ctx.fillStyle = trailEffect.color; ctx.fillRect(head.x - cellSize * 0.14, head.y - cellSize * 0.14, cellSize * 0.28, cellSize * 0.28); }
      }
    }
    ctx.restore();
  }

  renderPlayers(ctx, cellSize, skin, interpolation) {
    const now = performance.now();
    for (const player of this.players.values()) {
      if (!player.alive) continue;
      if (player.invulnerableTicks > 0 && Math.floor(now / 100) % 2 === 0) continue;
      const x = player.prevX + (player.x - player.prevX) * interpolation;
      const y = player.prevY + (player.y - player.prevY) * interpolation;
      const px = x * cellSize, py = y * cellSize;
      const cx = px + cellSize / 2, cy = py + cellSize / 2;
      const color = player.id === 1 ? skin.color : getPlayerColor(player.id, skin.color);
      const hat = player.human ? getHatById(this.callbacks.getHat?.() || 'none') : getHatById('none');
      const isLeader = player.id === this.leaderId;
      const targetAngle = Math.atan2(player.dy, player.dx);
      const previousAngle = this.renderAngles.get(player.id) ?? targetAngle;
      const angleDelta = Math.atan2(Math.sin(targetAngle - previousAngle), Math.cos(targetAngle - previousAngle));
      const angle = previousAngle + angleDelta * (1 - Math.exp(-(this.frameDeltaMs || 1000 / 60) / 80));
      this.renderAngles.set(player.id, angle);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.47, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.37, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cellSize * 0.34, 0);
      ctx.lineTo(-cellSize * 0.12, -cellSize * 0.16);
      ctx.lineTo(-cellSize * 0.12, cellSize * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const displayName = player.human ? (this.callbacks.getLanguage?.() === 'ru' ? 'ВЫ' : 'YOU') : player.name;
      if (displayName) {
        ctx.save();
        ctx.font = `600 ${Math.max(8, cellSize * 0.38)}px Manrope, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, cellSize * 0.12);
        ctx.strokeStyle = '#10131c';
        ctx.fillStyle = isLeader ? '#ffd76a' : '#f4f6ff';
        const labelY = py - cellSize * 0.08;
        ctx.strokeText(displayName, cx, labelY, 112);
        ctx.fillText(displayName, cx, labelY, 112);
        ctx.restore();
      }
      if (hat.id !== 'none' && player.human) {
        ctx.save(); ctx.fillStyle = hat.id === 'halo' ? '#ffe8a6' : '#f5f2ff'; ctx.strokeStyle = '#111522'; ctx.lineWidth = Math.max(0.6, cellSize * 0.05);
        if (hat.id === 'halo') { ctx.beginPath(); ctx.ellipse(px + cellSize / 2, py + cellSize * 0.12, cellSize * 0.24, cellSize * 0.07, 0, 0, Math.PI * 2); ctx.stroke(); }
        else if (hat.id === 'crown' || hat.id === 'party') { ctx.beginPath(); ctx.moveTo(px + cellSize * 0.28, py + cellSize * 0.23); ctx.lineTo(px + cellSize * 0.36, py + (hat.id === 'crown' ? cellSize * 0.05 : cellSize * 0.02)); ctx.lineTo(px + cellSize * 0.5, py + cellSize * 0.2); ctx.lineTo(px + cellSize * 0.65, py + (hat.id === 'crown' ? cellSize * 0.05 : cellSize * 0.02)); ctx.lineTo(px + cellSize * 0.73, py + cellSize * 0.23); ctx.closePath(); ctx.fill(); }
        else { ctx.fillRect(px + cellSize * 0.22, py + cellSize * 0.1, cellSize * 0.56, cellSize * 0.12); ctx.fillRect(px + cellSize * 0.32, py + cellSize * 0.02, cellSize * 0.36, cellSize * 0.12); }
        ctx.restore();
      }
      if (isLeader) {
        const crownPath = new Path2D();
        crownPath.moveTo(-0.32, 0);
        crownPath.lineTo(-0.32, -0.24);
        crownPath.lineTo(-0.16, -0.09);
        crownPath.lineTo(-0.16, -0.31);
        crownPath.lineTo(0, -0.11);
        crownPath.lineTo(0.16, -0.31);
        crownPath.lineTo(0.16, -0.09);
        crownPath.lineTo(0.32, -0.24);
        crownPath.lineTo(0.32, 0);
        crownPath.closePath();
        ctx.save();
        ctx.translate(cx, py + cellSize * 0.02);
        ctx.scale(cellSize, cellSize);
        ctx.fillStyle = '#ffd76a';
        ctx.globalAlpha = 0.2;
        ctx.fill(crownPath);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffd34f';
        ctx.lineWidth = 1.8 / cellSize;
        ctx.lineJoin = 'round';
        ctx.stroke(crownPath);
        ctx.restore();
      }
      if (player.human && now - this.startedAt < 5000) {
        const cx = px + cellSize / 2, cy = py + cellSize / 2;
        const tipX = cx + player.dx * cellSize * 0.43, tipY = cy + player.dy * cellSize * 0.43;
        const sideX = cx - player.dx * cellSize * 0.08 + player.dy * cellSize * 0.18;
        const sideY = cy - player.dy * cellSize * 0.08 - player.dx * cellSize * 0.18;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(sideX, sideY); ctx.lineTo(cx - player.dx * cellSize * 0.08 - player.dy * cellSize * 0.18, cy - player.dy * cellSize * 0.08 + player.dx * cellSize * 0.18); ctx.closePath(); ctx.fill();
      }
    }
  }

  renderCountdown(width, height) {
    if (this.countdownFinished) return;
    const remaining = Math.max(1, Math.ceil((this.countdownEndAt - performance.now()) / 1000));
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#080a1170'; ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = '800 72px Manrope, sans-serif';
    ctx.shadowColor = '#9b7bff'; ctx.shadowBlur = 28;
    ctx.fillText(String(remaining), width / 2, height / 2);
    ctx.restore();
  }

  createParticles(count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool.pop() || {};
      particle.angle = Math.PI * 2 * i / count;
      particle.speed = 0.6 + (i % 5) * 0.32;
      particles.push(particle);
    }
    return particles;
  }

  addEffect(effect) {
    const pooled = this.effectPool.pop();
    if (pooled) Object.assign(pooled, effect);
    this.effects.push(pooled || effect);
  }

  measureRenderPerformance(time) {
    this.fpsFrames++;
    const elapsed = time - this.fpsWindowStarted;
    if (elapsed < 1000) return;
    this.measuredFps = this.fpsFrames * 1000 / elapsed;
    const previousQuality = this.qualityLevel;
    if (this.measuredFps < 45) this.qualityLevel = Math.max(0, this.qualityLevel - 1);
    else if (this.measuredFps > 57) this.qualityLevel = Math.min(2, this.qualityLevel + 1);
    if (previousQuality !== this.qualityLevel) this.terrainDirty = true;
    this.fpsFrames = 0;
    this.fpsWindowStarted = time;
    this.callbacks.onPerformance?.({
      fps: Math.round(this.measuredFps),
      quality: ['low', 'balanced', 'high'][this.qualityLevel],
      ...this.renderMetrics
    });
  }

  renderEffects(ctx, cellSize) {
    const now = performance.now();
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index];
      const progress = (now - effect.started) / effect.duration;
      if (progress >= 1) {
        this.effects.splice(index, 1);
        for (const particle of effect.particles || []) this.particlePool.push(particle);
        effect.particles = null;
        this.effectPool.push(effect);
        continue;
      }
      const cx = (effect.x + 0.5) * cellSize;
      const cy = (effect.y + 0.5) * cellSize;
      if (effect.type === 'capture') {
        // Expanding wave starts at the trail endpoint and blooms across the captured land.
        ctx.save();
        ctx.globalAlpha = (1 - progress) * 0.75;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1, cellSize * 0.09);
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * (0.7 + progress * (this.qualityLevel === 0 ? 2.8 : 5.2)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (this.qualityLevel > 0) {
        const particles = effect.particles ?? [];
        const stride = this.qualityLevel === 1 ? 2 : 1;
        for (let particleIndex = 0; particleIndex < particles.length; particleIndex += stride) {
          const particle = particles[particleIndex];
          const distance = progress * cellSize * particle.speed * 8;
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(particle.angle) * distance, cy + Math.sin(particle.angle) * distance,
            Math.max(1, cellSize * 0.13 * (1 - progress)), 0, Math.PI * 2);
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
