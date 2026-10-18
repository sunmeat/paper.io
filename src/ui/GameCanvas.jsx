import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Game } from '../engine/Game.js';

const GameCanvas = forwardRef(function GameCanvas({ onStats, onGameOver }, ref) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  useImperativeHandle(ref, () => ({
    pause() {
      gameRef.current?.setPaused(true);
    },
    resume() {
      gameRef.current?.setPaused(false);
    },
    restart() {
      gameRef.current?.restart();
    }
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const game = new Game(canvas, { onStats, onGameOver });
    gameRef.current = game;
    return () => {
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [onStats, onGameOver]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Игровое поле Paper.io" />;
});

export default GameCanvas;
