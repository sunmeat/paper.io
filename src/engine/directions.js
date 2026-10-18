export function isReverseDirection(current, next) {
  return current[0] === -next[0] && current[1] === -next[1];
}
