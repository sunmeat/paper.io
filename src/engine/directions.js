const OPPOSITE_DIRECTION = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left'
});

export function isReverseDirection(currentDirection, nextDirection) {
  return OPPOSITE_DIRECTION[currentDirection] === nextDirection;
}
