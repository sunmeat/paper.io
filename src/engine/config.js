/** Shared gameplay tuning values. */
export const GAME_CONFIG = Object.freeze({
  cellSize: 12,
  moveIntervalMs: 100,
  fixedStepMs: 1000 / 30,
  maxFrameDeltaMs: 250,
  statsIntervalMs: 150,
  swipeThresholdPx: 24,
  minColumns: 16,
  minRows: 24,
  botCount: 10,
  seed: 0x51f15e,
  playerStartWidth: 5,
  playerStartHeight: 4,
  botStartWidth: 4,
  botStartHeight: 3,
  respawnSteps: 12
});
