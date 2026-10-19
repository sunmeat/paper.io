import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { playCapture, playDeath, unlockAudio } from '../engine/audio.js';
import { vibrate } from '../engine/haptics.js';
import { Game } from '../engine/Game.js';
import { useGameStore } from '../store/gameStore.js';

const GameCanvas = forwardRef(function GameCanvas({ onStats, onGameOver, mapId = 'circle' }, ref) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useImperativeHandle(ref, () => ({
    pause() { gameRef.current?.setPaused(true); },
    resume() { gameRef.current?.setPaused(false); },
    restart() { gameRef.current?.restart(); }
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let game;
    game = new Game(canvas, {
      mapId,
      observer: new URLSearchParams(window.location.search).get('observer') === '1',
      onStats: stats => onStats?.({
        ...stats,
        top5: (stats.top5 || []).map(player => ({
          ...player,
          name: game?.players.get(player.id)?.name || (player.id === 1 ? 'Игрок' : `Бот ${player.id - 1}`)
        }))
      }),
      getSkin: () => useGameStore.getState().equippedSkin
    });
    const events = game.simulation.events;
    let gameOverTimer = null;
    let earnedCoins = 0;
    const unsubscribe = [
      events.on('capture', event => {
        if (!event.human) return;
        playCapture();
        vibrate(18);
        const reward = Math.max(1, event.captured);
        earnedCoins += reward;
        useGameStore.getState().addCoins(reward);
        useGameStore.getState().awardAchievement('first-capture');
        const total = Math.max(1, game.grid.walkableCount || game.grid.owners.length);
        window.dispatchEvent(new CustomEvent('paperio:capture', {
          detail: { percent: Math.max(1, Math.round(event.captured / total * 100)), x: event.x, y: event.y }
        }));
      }),
      events.on('kill', event => {
        const killer = game.players.get(event.killerId);
        const victim = game.players.get(event.victimId);
        window.dispatchEvent(new CustomEvent('paperio:kill', {
          detail: {
            killerName: killer?.human ? 'Вы' : killer?.name || `Бот ${event.killerId}`,
            victimName: victim?.human ? 'Вы' : victim?.name || `Бот ${event.victimId}`,
            killerId: event.killerId,
            victimId: event.victimId
          }
        }));
        if (event.victimId !== 1 && event.killerHuman) {
          earnedCoins += 25;
          useGameStore.getState().addCoins(25);
        }
      }),
      events.on('death', event => {
        if (!event.human) return;
        playDeath();
        vibrate([35, 30, 60]);
      }),
      events.on('gameOver', snapshot => {
        const finalSnapshot = { ...snapshot, roundTimeMs: Math.max(0, performance.now() - game.startedAt), roundCoinsEarned: earnedCoins };
        gameOverTimer = window.setTimeout(() => onGameOver?.(finalSnapshot), 900);
      })
    ];

    gameRef.current = game;
    return () => {
      for (const off of unsubscribe) off();
      if (gameOverTimer !== null) window.clearTimeout(gameOverTimer);
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [onStats, onGameOver, mapId]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Paper.io game arena" />;
});

export default GameCanvas;
