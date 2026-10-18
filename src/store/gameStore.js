import { create } from 'zustand';

const INITIAL_SNAPSHOT = {
  territory: 0,
  score: 0,
  bots: 3,
  over: false,
  paused: false,
  top5: []
};

/** Zustand bridge for infrequent engine snapshots used by the HUD. */
export const useGameStore = create(set => ({
  snapshot: INITIAL_SNAPSHOT,
  setSnapshot: snapshot => set({ snapshot }),
  resetSnapshot: () => set({ snapshot: INITIAL_SNAPSHOT })
}));
