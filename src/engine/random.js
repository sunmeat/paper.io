/**
 * Creates a deterministic Mulberry32 pseudo-random number generator.
 * @param {number} seed Initial 32-bit seed.
 * @returns {() => number} A function returning values in [0, 1).
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
