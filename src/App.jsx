import { useCallback, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trophy, Zap } from 'lucide-react';
import GameCanvas from './ui/GameCanvas.jsx';
import { useGameStore } from './store/gameStore.js';

function App() {
  const gameRef = useRef(null);
  const stats = useGameStore(state => state.snapshot);
  const setSnapshot = useGameStore(state => state.setSnapshot);
  const resetSnapshot = useGameStore(state => state.resetSnapshot);
  const [round, setRound] = useState(0);
  const [paused, setPaused] = useState(false);

  const handleStats = useCallback(nextStats => setSnapshot(nextStats), [setSnapshot]);
  const handleGameOver = useCallback(nextStats => {
    setSnapshot(nextStats);
    setPaused(false);
  }, [setSnapshot]);

  const togglePause = () => {
    if (paused) gameRef.current?.resume();
    else gameRef.current?.pause();
    setPaused(value => !value);
  };

  const restart = () => {
    resetSnapshot();
    setPaused(false);
    setRound(value => value + 1);
  };

  return (
    <main className="game-shell">
      <GameCanvas key={round} ref={gameRef} onStats={handleStats} onGameOver={handleGameOver} />
      <div className="top-hud">
        <div className="brand">
          <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
          <span>PAPER<span className="brand-dot">.IO</span></span>
        </div>
        <div className="stat-pill"><span>ТЕРРИТОРИЯ</span><strong>{stats.territory}%</strong></div>
        <button className="hud-button" onClick={togglePause} aria-label={paused ? 'Продолжить' : 'Пауза'}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button className="hud-button" onClick={restart} aria-label="Начать заново"><RotateCcw size={18} /></button>
      </div>
      <div className="side-hud">
        <div className="legend"><i className="legend-player" /> ТЫ</div>
        <div className="legend"><i className="legend-pink" /> СОПЕРНИКИ <strong>{stats.bots}</strong></div>
      </div>
      <div className="bottom-hud">
        <div className="tip-icon"><Trophy size={17} /></div>
        <div><strong>Рисуй. Замыкай. Захватывай.</strong><span>Не дай врагам пересечь твой след</span></div>
        <div className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
      </div>
      {(paused || stats.over) && (
        <div className="game-overlay">
          <div className="overlay-card">
            <span className="overlay-kicker">{stats.over ? 'КОНЕЦ ИГРЫ' : 'ПАУЗА'}</span>
            <h1>{stats.over ? 'След оборван.' : 'Передышка.'}</h1>
            <p>{stats.over ? `Ты захватил ${stats.territory}% поля. Попробуем ещё раз?` : 'Арена подождёт. Готов продолжить?'}</p>
            <button className="primary-button" onClick={stats.over ? restart : togglePause}>
              {stats.over ? <RotateCcw size={17} /> : <Play size={17} />}
              {stats.over ? 'ЕЩЁ РАУНД' : 'ПРОДОЛЖИТЬ'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
