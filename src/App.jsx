import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Trophy, Zap, Shield } from 'lucide-react';

const IS_WIDE = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;
const W = IS_WIDE ? 56 : 36;
const H = IS_WIDE ? 36 : 48;
const COLORS = ['#9b7bff', '#ff6685', '#ffbd59', '#42d9c0'];
const keyOf = (x, y) => y * W + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

function createGame() {
  const cells = Array(W * H).fill(-1);
  const start = { x: Math.floor(W * 0.22), y: Math.floor(H * 0.52) };
  for (let y = start.y - 3; y <= start.y + 3; y++) {
    for (let x = start.x - 3; x <= start.x + 3; x++) {
      if (inside(x, y)) cells[keyOf(x, y)] = 0;
    }
  }

  const bots = [
    { id: 1, x: Math.floor(W * 0.76), y: Math.floor(H * 0.28), dx: -1, dy: 0, trail: [], alive: true, color: COLORS[1], turn: 0 },
    { id: 2, x: Math.floor(W * 0.76), y: Math.floor(H * 0.74), dx: 0, dy: -1, trail: [], alive: true, color: COLORS[2], turn: 0 },
    { id: 3, x: Math.floor(W * 0.52), y: Math.floor(H * 0.15), dx: 1, dy: 0, trail: [], alive: true, color: COLORS[3], turn: 0 }
  ];

  for (const bot of bots) {
    for (let y = bot.y - 2; y <= bot.y + 2; y++) {
      for (let x = bot.x - 2; x <= bot.x + 2; x++) {
        if (inside(x, y) && cells[keyOf(x, y)] === -1) cells[keyOf(x, y)] = bot.id;
      }
    }
  }

  return {
    cells,
    player: { ...start, dx: 1, dy: 0, trail: [], alive: true, next: null },
    bots,
    paused: false,
    over: false,
    won: false,
    tick: 0,
    score: 0,
    best: Number(localStorage.getItem('paperio-best') || 0)
  };
}

function capture(cells, trail, owner) {
  for (const index of trail) cells[index] = owner;
  const seen = new Uint8Array(W * H);
  const queue = [];
  for (let x = 0; x < W; x++) {
    for (const y of [0, H - 1]) {
      const i = keyOf(x, y);
      if (cells[i] === -1 && !seen[i]) { seen[i] = 1; queue.push(i); }
    }
  }
  for (let y = 0; y < H; y++) {
    for (const x of [0, W - 1]) {
      const i = keyOf(x, y);
      if (cells[i] === -1 && !seen[i]) { seen[i] = 1; queue.push(i); }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % W, y = Math.floor(i / W);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!inside(nx, ny)) continue;
      const ni = keyOf(nx, ny);
      if (!seen[ni] && cells[ni] === -1) { seen[ni] = 1; queue.push(ni); }
    }
  }
  for (let i = 0; i < cells.length; i++) if (cells[i] === -1 && !seen[i]) cells[i] = owner;
}

function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [ui, setUi] = useState({ score: 0, best: Number(localStorage.getItem('paperio-best') || 0), paused: false, over: false, sound: true, enemies: 3 });
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
    const p = g.player;
    const direction = p.next ?? p;
    if (dx === -direction.dx && dy === -direction.dy) return;
    p.next = { dx, dy };
    setHelp(false);
  }, []);

  useEffect(() => {
    const onKey = e => {
      const map = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      if (map[e.key]) { e.preventDefault(); steer(...map[e.key]); }
      if (e.key === ' ') { e.preventDefault(); setUi(v => ({ ...v, paused: !v.paused })); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame;
    let last = 0;
    let accumulator = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const move = (entity, owner, isPlayer) => {
      if (!entity.alive) return;
      const g = gameRef.current;
      if (entity.next) {
        entity.dx = entity.next.dx;
        entity.dy = entity.next.dy;
        entity.next = null;
      }

      const nx = entity.x + entity.dx;
      const ny = entity.y + entity.dy;

      if (!inside(nx, ny)) {
        if (isPlayer) {
          entity.alive = false;
          g.over = true;
        } else {
          entity.dx *= -1;
          entity.dy *= -1;
        }
        return;
      }

      const idx = keyOf(nx, ny);
      const cell = g.cells[idx];

      // Touching an opponent's open trail eliminates its owner, not the attacker.
      const rivals = [g.player, ...g.bots].filter(other => other !== entity && other.alive);
      for (const rival of rivals) {
        if (!rival.trail.includes(idx)) continue;
        rival.alive = false;
        rival.trail = [];
        if (rival === g.player) {
          g.over = true;
        } else {
          for (let i = 0; i < g.cells.length; i++) {
            if (g.cells[i] === rival.id) g.cells[i] = -1;
          }
        }
      }

      // Crossing your own open trail is fatal.
      if (entity.trail.includes(idx)) {
        entity.alive = false;
        if (isPlayer) g.over = true;
        return;
      }

      // A player cannot enter enemy territory. Bots turn away from it.
      if (cell >= 0 && cell !== owner) {
        if (isPlayer) {
          entity.alive = false;
          g.over = true;
        } else {
          entity.dx *= -1;
          entity.dy *= -1;
        }
        return;
      }

      if (cell === owner && entity.trail.length > 0) {
        capture(g.cells, entity.trail, owner);
        entity.trail = [];
      } else if (cell === -1) {
        entity.trail.push(idx);
      }

      entity.x = nx;
      entity.y = ny;
    };

    const tick = () => {
      const g = gameRef.current;
      if (!g || g.paused || ui.paused || g.over) return;
      g.tick++;
      move(g.player, 0, true);
      g.bots.forEach(bot => {
        if (g.tick % (bot.id === 2 ? 2 : 3) !== 0) return;
        bot.turn++;
        if (bot.turn % 5 === 0 && Math.random() < 0.7) {
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) => dx !== -bot.dx || dy !== -bot.dy);
          const d = dirs[Math.floor(Math.random() * dirs.length)];
          bot.dx = d[0]; bot.dy = d[1];
        }
        move(bot, bot.id, false);
      });
      const owned = g.cells.filter(c => c === 0).length;
      const score = Math.round(owned / g.cells.length * 100);
      g.score = score;
      g.won = g.player.alive && (g.bots.every(bot => !bot.alive) || score >= 100);
      if (g.won) g.over = true;
      if (score > g.best) {
        g.best = score;
        localStorage.setItem('paperio-best', String(score));
      }
      setUi(v => ({ ...v, score, best: g.best, over: g.over, won: g.won, enemies: g.bots.filter(bot => bot.alive).length }));
    };

    const draw = (time) => {
      const g = gameRef.current;
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width, ch = rect.height;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#111522';
      ctx.fillRect(0, 0, cw, ch);
      if (g) {
        const cell = Math.min(cw / W, ch / H);
        const ox = (cw - cell * W) / 2, oy = (ch - cell * H) / 2;
        ctx.fillStyle = '#1a2030';
        ctx.fillRect(ox, oy, cell * W, cell * H);
        for (let i = 0; i < g.cells.length; i++) {
          const owner = g.cells[i];
          if (owner < 0) continue;
          ctx.globalAlpha = owner === 0 ? 0.88 : 0.76;
          ctx.fillStyle = owner === 0 ? COLORS[0] : COLORS[owner];
          ctx.fillRect(ox + (i % W) * cell + 0.45, oy + Math.floor(i / W) * cell + 0.45, cell - 0.9, cell - 0.9);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.035)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= W; x++) { ctx.beginPath(); ctx.moveTo(ox+x*cell,oy); ctx.lineTo(ox+x*cell,oy+H*cell); ctx.stroke(); }
        for (let y = 0; y <= H; y++) { ctx.beginPath(); ctx.moveTo(ox,oy+y*cell); ctx.lineTo(ox+W*cell,oy+y*cell); ctx.stroke(); }
        const drawTrail = (entity, color) => {
          ctx.fillStyle = color;
          for (const i of entity.trail) ctx.fillRect(ox+(i%W)*cell+cell*.18,oy+Math.floor(i/W)*cell+cell*.18,cell*.64,cell*.64);
        };
        drawTrail(g.player, '#ffffff');
        g.bots.forEach(b => drawTrail(b, b.color));
        const drawPlayer = (entity, color) => {
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ox+(entity.x+.5)*cell,oy+(entity.y+.5)*cell,cell*.46,0,Math.PI*2); ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(ox+(entity.x+.5)*cell,oy+(entity.y+.5)*cell,cell*.3,0,Math.PI*2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ox+(entity.x+.5)*cell,oy+(entity.y+.5)*cell,cell*.1,0,Math.PI*2); ctx.fill();
        };
        drawPlayer(g.player, COLORS[0]);
        g.bots.forEach(b => drawPlayer(b, b.color));
      }
      if (time - last > 105) { accumulator += Math.min(time - last, 250); last = time; while (accumulator >= 105) { tick(); accumulator -= 105; } }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [ui.paused]);

  const togglePause = () => setUi(v => ({ ...v, paused: !v.paused }));
  const touchDown = e => { const point = e.touches?.[0] ?? e; setTouchStart({ x: point.clientX, y: point.clientY }); };
  const touchUp = e => {
    if (!touchStart) return;
    const point = e.changedTouches?.[0] ?? e;
    const dx = point.clientX - touchStart.x, dy = point.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) {
      if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1, 0);
      else steer(0, dy > 0 ? 1 : -1);
    }
    setTouchStart(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Territory home"><span className="brand-mark">P</span><span>paper<span className="brand-dot">.</span>io</span></a>
        <div className="online"><span className="online-dot" /> ARCADE MODE</div>
        <button className="icon-button sound-button" onClick={() => setUi(v => ({ ...v, sound: !v.sound }))} aria-label="Звук">{ui.sound ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button>
      </header>

      <section className="game-layout">
        <div className="game-heading">
          <div><div className="eyebrow"><Zap size={13}/> CLAIM YOUR SPACE</div><h1>Твоя территория<span>.</span></h1><p>Рискуй. Захватывай. Доминируй.</p></div>
          <div className="level-chip"><span>УРОВЕНЬ</span><strong>01</strong></div>
        </div>

        <div className="stats-row">
          <div className="stat-card"><span className="stat-icon purple"><Shield size={16}/></span><div><small>ТЕРРИТОРИЯ</small><strong>{ui.score}<em>%</em></strong></div></div>
          <div className="stat-card"><span className="stat-icon gold"><Trophy size={16}/></span><div><small>РЕКОРД</small><strong>{ui.best}<em>%</em></strong></div></div>
          <div className="stat-card enemies-stat"><span className="enemy-dots"><i/><i/><i/></span><div><small>СОПЕРНИКИ</small><strong>{String(ui.enemies).padStart(2, '0')}</strong></div></div>
        </div>

        <div className="arena-wrap">
          <div className="arena-top"><span><i className="live-dot"/> LIVE MAP</span><span>36 × 48 GRID</span></div>
          <div className="canvas-wrap" onTouchStart={touchDown} onTouchEnd={touchUp}>
            <canvas ref={canvasRef} aria-label="Игровое поле Paper.io" />
            {help && !ui.over && <div className="hint"><span className="hint-finger">☝️</span><strong>Свайпай, чтобы двигаться</strong><small>Замкни контур и захвати землю</small><button onClick={() => setHelp(false)}>ПОНЯТНО</button></div>}
            {ui.paused && !ui.over && <div className="game-overlay"><div className="overlay-icon"><Pause size={26}/></div><h2>Пауза</h2><p>Территория подождёт.</p><button className="primary-button" onClick={togglePause}><Play size={17} fill="currentColor"/> Продолжить</button></div>}
            {ui.over && <div className="game-overlay"><div className="overlay-icon defeat">✦</div><h2>{ui.won ? 'Победа!' : 'Игра окончена'}</h2><p>{ui.won ? 'Все соперники выбыли. Карта твоя!' : `Твоя территория: ${ui.score}%`}</p><button className="primary-button" onClick={restart}><RotateCcw size={17}/> Играть снова</button></div>}
          </div>
          <div className="arena-bottom"><span><i className="legend-player"/> ТЫ</span><span><i className="legend-enemy"/> СОПЕРНИКИ</span><button onClick={togglePause} disabled={ui.over}><Pause size={13}/> {ui.paused ? 'ПРОДОЛЖИТЬ' : 'ПАУЗА'}</button></div>
        </div>

        <div className="mobile-controls">
          <div className="controls-copy"><strong>Управление</strong><span>Нажимай или свайпай в нужную сторону</span></div>
          <div className="dpad">
            <button className="up" onClick={() => steer(0,-1)} aria-label="Вверх">▲</button>
            <button className="left" onClick={() => steer(-1,0)} aria-label="Влево">◀</button>
            <button className="down" onClick={() => steer(0,1)} aria-label="Вниз">▼</button>
            <button className="right" onClick={() => steer(1,0)} aria-label="Вправо">▶</button>
          </div>
        </div>

        <div className="tip"><span className="tip-star">✳</span><div><strong>Не оставляй след без защиты</strong><p>Пока ты за пределами своей зоны, враги могут перерезать твой след. Возвращайся домой!</p></div></div>
        <footer><span>MADE TO CLAIM</span><span>ONE MAP. NO MERCY.</span></footer>
      </section>
    </main>
  );
}

export default App;