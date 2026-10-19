import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { playCapture, playDeath, unlockAudio } from '../engine/audio.js';
import { vibrate } from '../engine/haptics.js';
import { Game } from '../engine/Game.js';
import { getPlayerColor } from '../engine/playerPalette.js';
import { getSkinById } from '../engine/skins.js';
import { useGameStore } from '../store/gameStore.js';

const GameCanvas = forwardRef(function GameCanvas({ onStats, onGameOver, mapId = 'circle', modeId = 'classic', countryId = 'ukraine', countryLevel = 1 }, ref) {
  const canvasRef = useRef(null);
  const minimapRef = useRef(null);
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
    let roundFinished = false;
    game = new Game(canvas, {
      mapId,
      modeId,
      countryLevel,
      observer: new URLSearchParams(window.location.search).get('observer') === '1',
      onStats: stats => {
        if (roundFinished) return;
        onStats?.({
          ...stats,
          top5: (stats.top5 || []).map(player => ({
            ...player,
            name: game?.players.get(player.id)?.name || (player.id === 1 ? 'Игрок' : `Бот ${player.id - 1}`)
          }))
        });
      },
      getSkin: () => useGameStore.getState().equippedSkin,
      getHat: () => useGameStore.getState().equippedHat,
      getTrail: () => useGameStore.getState().equippedTrail
    });
    const events = game.simulation.events;
    let gameOverTimer = null;
    let earnedCoins = 0;
    const minimapCanvas = minimapRef.current;
    const minimapCtx = minimapCanvas?.getContext('2d');
    const drawMinimap = () => {
      if (!minimapCanvas || !minimapCtx || !game?.grid) return;
      const grid = game.grid;
      const width = grid.width || game.cellsWide;
      const height = grid.height || game.cellsHigh;
      if (minimapCanvas.width !== width || minimapCanvas.height !== height) { minimapCanvas.width = width; minimapCanvas.height = height; }
      const image = minimapCtx.createImageData(width, height);
      const rgb = hex => [parseInt(hex.slice(1, 3), 16) || 0, parseInt(hex.slice(3, 5), 16) || 0, parseInt(hex.slice(5, 7), 16) || 0];
      const palette = new Map([...game.players.values()].map(player => [player.id, rgb(player.id === 1 ? getSkinById(useGameStore.getState().equippedSkin).color : getPlayerColor(player.id, getSkinById(useGameStore.getState().equippedSkin).color))]));
      for (let i = 0; i < grid.owners.length; i++) {
        const offset = i * 4;
        if (!grid.walkable[i]) { image.data[offset + 3] = 0; continue; }
        const owner = grid.trail[i] || grid.owners[i];
        const color = owner ? (palette.get(owner) || [140, 145, 165]) : [35, 40, 54];
        image.data[offset] = color[0]; image.data[offset + 1] = color[1]; image.data[offset + 2] = color[2]; image.data[offset + 3] = 255;
      }
      minimapCtx.putImageData(image, 0, 0);
      minimapCtx.fillStyle = '#fff';
      for (const player of game.players.values()) if (player.alive) { minimapCtx.fillStyle = player.id === 1 ? getSkinById(useGameStore.getState().equippedSkin).color : getPlayerColor(player.id, getSkinById(useGameStore.getState().equippedSkin).color); minimapCtx.fillRect(player.x, player.y, 1, 1); }
    };
    const minimapTimer = window.setInterval(drawMinimap, 200);
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
          detail: (() => { const rect = canvas.getBoundingClientRect(); const cellSize = Math.min(rect.width, rect.height) / 27; return { percent: Number((event.captured / total * 100).toFixed(3)), x: event.x, y: event.y, screenX: rect.width / 2 + (event.x + 0.5 - game.camera.x) * cellSize * game.camera.zoom, screenY: rect.height / 2 + (event.y + 0.5 - game.camera.y) * cellSize * game.camera.zoom }; })()
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
        if (roundFinished) return;
        roundFinished = true;
        const victoryReward = snapshot.outcome === 'victory' ? 150 : 0;
        const secretReward = snapshot.outcome === 'victory' && snapshot.secretConquered ? 500 : 0;
        const roundReward = victoryReward + secretReward;
        if (roundReward) { earnedCoins += roundReward; useGameStore.getState().addCoins(roundReward); }
        if (secretReward) window.dispatchEvent(new CustomEvent('paperio:fullmap'));
        const finalSnapshot = { ...snapshot, countryId, modeId, roundTimeMs: game.simulation.elapsedMs, roundCoinsEarned: earnedCoins, victoryReward, secretReward };
        gameOverTimer = window.setTimeout(() => onGameOver?.(finalSnapshot), 900);
      })
    ];

    gameRef.current = game;
    return () => {
      for (const off of unsubscribe) off();
      if (gameOverTimer !== null) window.clearTimeout(gameOverTimer);
      window.clearInterval(minimapTimer);
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, [onStats, onGameOver, mapId, modeId, countryId, countryLevel]);

  return <><canvas ref={canvasRef} className="game-canvas" aria-label="Paper.io game arena" /><canvas ref={minimapRef} className="game-minimap" aria-label="Minimap" /></>;
});

export default GameCanvas;
