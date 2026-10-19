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

    const game = new Game(canvas, {
      mapId,
      observer: new URLSearchParams(window.location.search).get('observer') === '1',
      onStats,
      getSkin: () => useGameStore.getState().equippedSkin
    });
    const events = game.simulation.events;
    let gameOverTimer = null;
    const unsubscribe = [
      events.on('capture', event => {
        if (!event.human) return;
        playCapture();
        vibrate(18);
        useGameStore.getState().addCoins(Math.max(1, event.captured));
        useGameStore.getState().awardAchievement('first-capture');
      }),
      events.on('kill', event => {
        if (event.victimId !== 1 && event.killerHuman) useGameStore.getState().addCoins(25);
      }),
      events.on('death', event => {
        if (!event.human) return;
        playDeath();
        vibrate([35, 30, 60]);
      }),
      events.on('gameOver', snapshot => { gameOverTimer = window.setTimeout(() => onGameOver?.(snapshot), 900); })
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
