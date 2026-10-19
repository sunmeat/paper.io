import { GAME_CONFIG } from './config.js';

const DIRECTIONS = {
  ArrowUp: [0, -1],
  w: [0, -1],
  W: [0, -1],
  ArrowDown: [0, 1],
  s: [0, 1],
  S: [0, 1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  A: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
  D: [1, 0]
};

/**
 * Attaches keyboard and touch controls to the game.
 * @param {HTMLCanvasElement} canvas Input surface.
 * @param {{queueDirection:(dx:number,dy:number)=>void}} game Game receiving directions.
 * @returns {() => void} Removes all registered listeners.
 */
export function bindInput(canvas, game) {
  let touchStart = null;
  let lastTouch = null;

  const onKeyDown = event => {
    const direction = DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();
    game.queueDirection(direction[0], direction[1]);
  };

  const onTouchStart = event => {
    event.preventDefault();
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
    lastTouch = touchStart;
  };

  const onTouchMove = event => {
    event.preventDefault();
    if (!touchStart || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - lastTouch.x;
    const dy = touch.clientY - lastTouch.y;
    const storedThreshold = Number(localStorage.getItem('paper-io-swipe-threshold'));
    const swipeThresholdPx = Number.isFinite(storedThreshold) && storedThreshold >= 8 && storedThreshold <= 48
      ? storedThreshold
      : GAME_CONFIG.swipeThresholdPx;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= swipeThresholdPx) {
      if (Math.abs(dx) > Math.abs(dy)) game.queueDirection(Math.sign(dx), 0);
      else game.queueDirection(0, Math.sign(dy));
      lastTouch = { x: touch.clientX, y: touch.clientY };
      touchStart = lastTouch;
    }
  };

  const onTouchEnd = event => {
    event.preventDefault();
    touchStart = null;
    lastTouch = null;
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
  window.addEventListener('keydown', onKeyDown);

  return () => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('keydown', onKeyDown);
  };
}
