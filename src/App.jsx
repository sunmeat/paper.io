import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Trophy, Zap, Shield } from 'lucide-react';

const SIZE = 100;
const COUNT = SIZE * SIZE;
const COLORS = ['#9b7bff', '#ff6685', '#ffbd59', '#42d9c0'];
const indexOf = (x, y) => y * SIZE + x;
const cellAt = (x, y) => ({ x: Math.floor(x), y: Math.floor(y) });
const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const arenaCell = (x, y) => {
  const dx = (x + .5 - SIZE / 2) / (SIZE / 2 - 5);
  const dy = (y + .5 - SIZE / 2) / (SIZE / 2 - 5);
  return dx * dx + dy * dy < 1.12;
};
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function createGame() {
  const cells = new Int8Array(COUNT).fill(-1);
  const player = { id: 0, x: 22, y: 50, angle: 0, targetAngle: 0, trail: [], alive: true, color: COLORS[0], speed: 15 };
  const bots = [
    { id: 1, x: 75, y: 27, angle: 2.7, targetAngle: 2.7, trail: [], alive: true, color: COLORS[1], speed: 10, think: 0 },
    { id: 2, x: 76, y: 73, angle: -2.5, targetAngle: -2.5, trail: [], alive: true, color: COLORS[2], speed: 9.4, think: 0 },
    { id: 3, x: 51, y: 17, angle: 1.4, targetAngle: 1.4, trail: [], alive: true, color: COLORS[3], speed: 9.8, think: 0 }
  ];
  const paintCircle = (cx, cy, radius, owner) => {
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(SIZE - 1, cy + radius); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(SIZE - 1, cx + radius); x++) {
        if (Math.hypot(x + .5 - cx, y + .5 - cy) <= radius && arenaCell(x, y) && cells[indexOf(x, y)] === -1) cells[indexOf(x, y)] = owner;
      }
    }
  };
  paintCircle(player.x, player.y, 5.4, 0);
  bots.forEach(bot => paintCircle(bot.x, bot.y, 4.4, bot.id));
  return { cells, player, bots, over: false, won: false, score: 0, best: Number(localStorage.getItem('paperio-best') || 0), particles: [] };
}

function capture(g, entity) {
  for (const i of entity.trail) g.cells[i] = entity.id;
  const seen = new Uint8Array(COUNT);
  const queue = new Int32Array(COUNT);
  let head = 0, tail = 0;
  for (let i = 0; i < COUNT; i++) {
    const x = i % SIZE, y = Math.floor(i / SIZE);
    if (!arenaCell(x, y) || g.cells[i] !== -1) { seen[i] = 1; continue; }
    const edge = !arenaCell(x - 1, y) || !arenaCell(x + 1, y) || !arenaCell(x, y - 1) || !arenaCell(x, y + 1);
    if (edge) { seen[i] = 1; queue[tail++] = i; }
  }
  while (head < tail) {
    const i = queue[head++], x = i % SIZE, y = Math.floor(i / SIZE);
    const neighbors = [x > 0 ? i - 1 : -1, x < SIZE - 1 ? i + 1 : -1, y > 0 ? i - SIZE : -1, y < SIZE - 1 ? i + SIZE : -1];
    for (const n of neighbors) if (n >= 0 && !seen[n] && g.cells[n] === -1 && arenaCell(n % SIZE, Math.floor(n / SIZE))) { seen[n] = 1; queue[tail++] = n; }
  }
  for (let i = 0; i < COUNT; i++) if (g.cells[i] === -1 && !seen[i] && arenaCell(i % SIZE, Math.floor(i / SIZE))) g.cells[i] = entity.id;
  entity.trail = [];
}

function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef(new Set());
  const pointerRef = useRef(null);
  const [ui, setUi] = useState({ score: 0, best: Number(localStorage.getItem('paperio-best') || 0), paused: false, over: false, won: false, sound: true, enemies: 3 });
  const [help, setHelp] = useState(true);
  const [touchStart, setTouchStart] = useState(null);

  const restart = useCallback(() => {
    gameRef.current = createGame();
    setUi(v => ({ ...v, score: 0, paused: false, over: false, won: false, enemies: 3 }));
    setHelp(true);
  }, []);
  useEffect(() => { restart(); }, [restart]);

  const steer = useCallback((dx, dy) => {
    const g = gameRef.current;
    if (!g || g.over) return;
    g.player.targetAngle = Math.atan2(dy, dx);
    setHelp(false);
  }, []);

  useEffect(() => {
    const onKeyDown = e => {
      const k = e.key.toLowerCase();
      const map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1] };
      if (map[k]) { e.preventDefault(); keysRef.current.add(k); steer(...map[k]); }
      if (k === ' ') { e.preventDefault(); setUi(v => ({ ...v, paused: !v.paused })); }
    };
    const onKeyUp = e => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [steer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0, last = 0, hudClock = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);

    const eliminate = (g, entity) => {
      if (!entity.alive) return;
      entity.alive = false; entity.trail = [];
      if (entity.id === 0) { g.over = true; return; }
      for (let i = 0; i < COUNT; i++) if (g.cells[i] === entity.id) g.cells[i] = -1;
    };
    const markTrail = (g, entity) => {
      const cx = Math.floor(entity.x), cy = Math.floor(entity.y);
      if (!inside(cx, cy) || !arenaCell(cx, cy)) { eliminate(g, entity); return; }
      const idx = indexOf(cx, cy), owner = g.cells[idx];
      if (entity.trail.length && owner === entity.id) { capture(g, entity); return; }
      if (owner >= 0 && owner !== entity.id) {
        const rival = [g.player, ...g.bots].find(e => e.id === owner && e.alive);
        if (rival && rival.trail.length) eliminate(g, rival);
        if (entity.id === 0 && g.cells[idx] !== 0) { eliminate(g, entity); return; }
        if (entity.id !== 0 && g.cells[idx] !== -1 && g.cells[idx] !== entity.id) {
          entity.targetAngle += Math.PI * (0.65 + Math.random() * 0.7);
          return;
        }
      }
      if (owner === -1 && entity.trail[entity.trail.length - 1] !== idx) entity.trail.push(idx);
    };
    const move = (g, entity, dt, now) => {
      if (!entity.alive) return;
      if (entity.id !== 0) {
        entity.think -= dt;
        if (entity.think <= 0) {
          entity.think = .7 + Math.random() * 1.1;
          const aheadX = entity.x + Math.cos(entity.angle) * 7, aheadY = entity.y + Math.sin(entity.angle) * 7;
          const c = cellAt(aheadX, aheadY);
          if (!inside(c.x, c.y) || !arenaCell(c.x, c.y) || (g.cells[indexOf(c.x, c.y)] >= 0 && g.cells[indexOf(c.x, c.y)] !== entity.id)) {
            const choices = [entity.angle + 1.15, entity.angle - 1.15, entity.angle + 2.25, entity.angle - 2.25];
            entity.targetAngle = choices[Math.floor(Math.random() * choices.length)];
          } else if (Math.random() < .36) entity.targetAngle += (Math.random() - .5) * 2.3;
          if (entity.trail.length && Math.random() < .28) {
            const owned = [];
            for (let i = 0; i < COUNT; i++) if (g.cells[i] === entity.id) owned.push(i);
            if (owned.length) {
              const i = owned[Math.floor(Math.random() * owned.length)];
              entity.targetAngle = Math.atan2(Math.floor(i / SIZE) + .5 - entity.y, i % SIZE + .5 - entity.x);
            }
          }
        }
      }
      const turnRate = entity.id === 0 ? 4.8 : 2.4;
      entity.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, angleDiff(entity.angle, entity.targetAngle)));
      const distance = entity.speed * dt;
      const steps = Math.max(1, Math.ceil(distance / .22));
      let lastProcessedIdx = indexOf(Math.floor(entity.x), Math.floor(entity.y));
      for (let s = 0; s < steps; s++) {
        entity.x += Math.cos(entity.angle) * distance / steps;
        entity.y += Math.sin(entity.angle) * distance / steps;
        if (entity.x < 1 || entity.y < 1 || entity.x > SIZE - 2 || entity.y > SIZE - 2 || !arenaCell(Math.floor(entity.x), Math.floor(entity.y))) { eliminate(g, entity); return; }
        const idx = indexOf(Math.floor(entity.x), Math.floor(entity.y));
        if (idx === lastProcessedIdx) continue;
        lastProcessedIdx = idx;
        for (const rival of [g.player, ...g.bots]) {
          if (rival !== entity && rival.alive && rival.trail.includes(idx)) eliminate(g, rival);
        }
        if (!entity.alive) return;
        if (entity.trail.includes(idx)) { eliminate(g, entity); return; }
        markTrail(g, entity);
        if (!entity.alive) return;
      }
    };
    const draw = time => {
      const g = gameRef.current, r = canvas.getBoundingClientRect(), w = r.width, h = r.height;
      const dt = last ? Math.min((time - last) / 1000, .035) : .016; last = time;
      if (g && !ui.paused && !g.over) {
        const keys = keysRef.current;
        const map = { arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],q:[-1,-1],e:[1,-1],z:[-1,1],c:[1,1] };
        const active = [...keys].find(k => map[k]);
        if (active) g.player.targetAngle = Math.atan2(map[active][1], map[active][0]);
        move(g, g.player, dt, time);
        g.bots.forEach(b => move(g, b, dt, time));
        hudClock += dt;
        if (hudClock > .12) {
          hudClock = 0;
          const owned = g.cells.reduce((n, c) => n + (c === 0 ? 1 : 0), 0);
          g.score = Math.round(owned / COUNT * 100);
          g.won = g.player.alive && (g.bots.every(b => !b.alive) || g.score >= 98);
          if (g.won) g.over = true;
          if (g.score > g.best) { g.best = g.score; localStorage.setItem('paperio-best', String(g.score)); }
          setUi(v => ({ ...v, score: g.score, best: g.best, over: g.over, won: g.won, enemies: g.bots.filter(b => b.alive).length }));
        }
      }
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#101521'; ctx.fillRect(0, 0, w, h);
      const scale = Math.min(w, h) / SIZE, ox = (w - SIZE * scale) / 2, oy = (h - SIZE * scale) / 2;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
      ctx.beginPath(); ctx.ellipse(50, 50, 47.5, 47.5, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#202838'; ctx.fillRect(0, 0, SIZE, SIZE);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const owner = g?.cells[indexOf(x, y)] ?? -1;
        if (owner < 0) continue;
        ctx.fillStyle = COLORS[owner];
        ctx.globalAlpha = owner === 0 ? .88 : .72;
        ctx.fillRect(x + .02, y + .02, .96, .96);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff09'; ctx.lineWidth = .12;
      for (let i = 5; i < 100; i += 5) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 100); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(100, i); ctx.stroke(); }
      const drawEntity = (entity, player) => {
        if (!entity.alive) return;
        if (entity.trail.length) {
          ctx.beginPath();
          entity.trail.forEach((idx, i) => { const x = idx % SIZE + .5, y = Math.floor(idx / SIZE) + .5; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
          ctx.lineTo(entity.x, entity.y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = player ? 1.2 : 1; ctx.strokeStyle = entity.color; ctx.stroke();
          ctx.globalAlpha = .85; ctx.fillStyle = entity.color;
          for (const idx of entity.trail) ctx.fillRect(idx % SIZE + .18, Math.floor(idx / SIZE) + .18, .64, .64);
          ctx.globalAlpha = 1;
        }
        ctx.save(); ctx.translate(entity.x, entity.y); ctx.rotate(entity.angle);
        ctx.shadowColor = entity.color; ctx.shadowBlur = player ? 1.3 : .6;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, player ? 1.25 : 1.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = entity.color; ctx.beginPath(); ctx.arc(0, 0, player ? .93 : .78, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(.25, -.18, .25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      };
      if (g) { drawEntity(g.player, true); g.bots.forEach(b => drawEntity(b, false)); }
      ctx.restore();
      ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ox + 50 * scale, oy + 50 * scale, 47.5 * scale, 47.5 * scale, 0, 0, Math.PI * 2); ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ui.paused]);

  const togglePause = () => setUi(v => ({ ...v, paused: !v.paused }));
  const touchDown = e => { const p = e.touches?.[0] ?? e; setTouchStart({ x: p.clientX, y: p.clientY }); };
  const touchUp = e => {
    if (!touchStart) return;
    const p = e.changedTouches?.[0] ?? e, dx = p.clientX - touchStart.x, dy = p.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 15) steer(dx / Math.hypot(dx, dy), dy / Math.hypot(dx, dy));
    setTouchStart(null);
  };
  const pointMove = e => {
    const rect = canvasRef.current?.getBoundingClientRect(), g = gameRef.current;
    if (!rect || !g?.player?.alive) return;
    const x = (e.clientX - rect.left) / rect.width * SIZE, y = (e.clientY - rect.top) / rect.height * SIZE;
    const dx = x - g.player.x, dy = y - g.player.y;
    if (Math.hypot(dx, dy) > 3) { g.player.targetAngle = Math.atan2(dy, dx); setHelp(false); }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Paper.io home"><span className="brand-mark">P</span><span>paper<span className="brand-dot">.</span>io</span></a>
        <div className="online"><span className="online-dot" /> ARCADE MODE</div>
        <button className="icon-button sound-button" onClick={() => setUi(v => ({ ...v, sound: !v.sound }))} aria-label="Звук">{ui.sound ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button>
      </header>
      <section className="game-layout">
        <div className="game-heading"><div><div className="eyebrow"><Zap size={13}/> CLAIM YOUR SPACE</div><h1>Захвати территорию<span>.</span></h1><p>Плавное движение. Рискованный захват. Твоя арена.</p></div><div className="level-chip"><span>АРЕНА</span><strong>01</strong></div></div>
        <div className="stats-row">
          <div className="stat-card"><span className="stat-icon purple"><Shield size={16}/></span><div><small>ТЕРРИТОРИЯ</small><strong>{ui.score}<em>%</em></strong></div></div>
          <div className="stat-card"><span className="stat-icon gold"><Trophy size={16}/></span><div><small>РЕКОРД</small><strong>{ui.best}<em>%</em></strong></div></div>
          <div className="stat-card enemies-stat"><span className="enemy-dots"><i/><i/><i/></span><div><small>СОПЕРНИКИ</small><strong>{String(ui.enemies).padStart(2, '0')}</strong></div></div>
        </div>
        <div className="arena-wrap">
          <div className="arena-top"><span><i className="live-dot"/> LIVE ARENA</span><span>FREE MOVEMENT</span></div>
          <div className="canvas-wrap" onTouchStart={touchDown} onTouchEnd={touchUp} onPointerMove={pointMove}>
            <canvas ref={canvasRef} aria-label="Игровая арена с захватом территории" />
            {help && !ui.over && <div className="hint"><span className="hint-finger">☝️</span><strong>Рискуй за пределами своей зоны</strong><small>Вернись в свою территорию, чтобы замкнуть след</small><button onClick={() => setHelp(false)}>ПОЕХАЛИ</button></div>}
            {ui.paused && !ui.over && <div className="game-overlay"><div className="overlay-icon"><Pause size={26}/></div><h2>Пауза</h2><p>Арена подождёт.</p><button className="primary-button" onClick={togglePause}><Play size={17} fill="currentColor"/> Продолжить</button></div>}
            {ui.over && <div className="game-overlay"><div className="overlay-icon defeat">✦</div><h2>{ui.won ? 'Победа!' : 'Игра окончена'}</h2><p>{ui.won ? 'Арена почти полностью твоя!' : `Твоя территория: ${ui.score}%`}</p><button className="primary-button" onClick={restart}><RotateCcw size={17}/> Играть снова</button></div>}
          </div>
          <div className="arena-bottom"><span><i className="legend-player"/> ТЫ</span><span><i className="legend-enemy"/> СОПЕРНИКИ</span><button onClick={togglePause} disabled={ui.over}><Pause size={13}/> {ui.paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА'}</button></div>
        </div>
        <div className="mobile-controls"><div className="controls-copy"><strong>Управление</strong><span>Мышь направляет движение. На клавиатуре работают WASD и стрелки.</span></div><div className="dpad"><button className="up" onClick={() => steer(0,-1)} aria-label="Вверх">▲</button><button className="left" onClick={() => steer(-1,0)} aria-label="Влево">◀</button><button className="down" onClick={() => steer(0,1)} aria-label="Вниз">▼</button><button className="right" onClick={() => steer(1,0)} aria-label="Вправо">▶</button></div></div>
        <div className="tip"><span className="tip-star">✳</span><div><strong>След уязвим, пока ты вне своей зоны</strong><p>Соперник может перерезать линию. Замыкай петлю, чтобы расширить территорию и не рискуй слишком долго.</p></div></div>
        <footer><span>CLAIM THE ARENA</span><span>KEEP MOVING</span></footer>
      </section>
    </main>
  );
}
export default App;