import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { HATS, SKINS, TRAIL_EFFECTS } from '../engine/skins.js';

const base = {
  selectedMap: 'circle',
  coins: 0,
  ownedSkins: ['classic'],
  equippedSkin: 'classic',
  ownedHats: ['none'],
  equippedHat: 'none',
  ownedTrails: ['none'],
  equippedTrail: 'none',
  achievements: [],
  lastDailyClaimDate: null,
  lastDailyClaimAt: 0,
  dailyStreak: 0,
  bestTerritory: 0,
  roundsPlayed: 0,
  selectedMode: 'classic',
  modeRecords: {}
};

const dateKey = (date = new Date()) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const snapshot = { territory: 0, score: 0, sessionScore: 0, bots: 10, over: false, paused: false, respawning: false, top5: [] };

function meetsUnlockRequirement(item, state) {
  const unlock = item.unlock;
  if (!unlock || unlock.type === 'free') return true;
  if (unlock.type === 'achievement') return state.achievements.includes(unlock.id);
  if (unlock.type === 'level') {
    const level = Math.max(1, Number(localStorage.getItem('paper-io-player-level')) || 1);
    return level >= unlock.level;
  }
  if (unlock.type === 'quest') {
    const captured = Math.max(0, Number(localStorage.getItem('paper-io-total-captured')) || 0);
    return captured >= unlock.captured;
  }
  return false;
}

export const useGameStore = create(persist((set, get) => ({
  screen: 'menu',
  paused: false,
  selectedMap: 'circle',
  selectedMode: 'classic',
  setSelectedMode: modeId => set({ selectedMode: modeId === 'sprint' ? 'sprint' : 'classic' }),
  setSelectedMap: selectedMap => set({ selectedMap }),
  language: localStorage.getItem('paper-io-language') || 'ru',
  settingsOpen: false,
  snapshot,
  ...base,
  setScreen: screen => set({ screen }),
  setPaused: paused => set({ paused }),
  toggleSettings: () => set(state => ({ settingsOpen: !state.settingsOpen })),
  setLanguage: language => {
    localStorage.setItem('paper-io-language', language);
    set({ language });
  },
  setSnapshot: nextSnapshot => set(state => {
    const achievements = [...state.achievements];
    if (nextSnapshot.territory >= 10 && !achievements.includes('territory-10')) achievements.push('territory-10');
    if (nextSnapshot.territory >= 25 && !achievements.includes('territory-25')) achievements.push('territory-25');
    return { snapshot: nextSnapshot, achievements };
  }),
  resetSnapshot: () => set({ snapshot, paused: false }),
  addCoins: amount => set(state => ({ coins: state.coins + Math.max(0, Math.floor(amount || 0)) })),
  awardAchievement: id => set(state => state.achievements.includes(id) ? {} : { achievements: [...state.achievements, id] }),
  finishRound: () => set(state => {
    const achievements = [...state.achievements];
    const roundsPlayed = state.roundsPlayed + 1;
    const modeId = state.snapshot?.modeId || state.selectedMode || 'classic';
    const modeRecords = { ...(state.modeRecords || {}) };
    if (!achievements.includes('first-round')) achievements.push('first-round');
    if (roundsPlayed >= 10 && !achievements.includes('rounds-10')) achievements.push('rounds-10');
    modeRecords[modeId] = Math.max(Number(modeRecords[modeId]) || 0, Number(state.snapshot.territory) || 0);
    return {
      roundsPlayed,
      bestTerritory: Math.max(state.bestTerritory, state.snapshot.territory || 0),
      modeRecords,
      achievements
    };
  }),
  claimDailyReward: () => {
    const state = get();
    const now = Date.now();
    const today = dateKey();
    if (state.lastDailyClaimDate && today <= state.lastDailyClaimDate) return { ok: false, reason: 'claimed' };
    if (state.lastDailyClaimAt && now - state.lastDailyClaimAt < 72000000) return { ok: false, reason: 'wait' };
    const streak = state.lastDailyClaimDate === dateKey(new Date(now - 86400000)) ? state.dailyStreak + 1 : 1;
    const reward = 100 + Math.min(streak - 1, 6) * 25;
    const achievements = [...state.achievements];
    if (!achievements.includes('daily-first')) achievements.push('daily-first');
    if (streak >= 7 && !achievements.includes('daily-7')) achievements.push('daily-7');
    set({ coins: state.coins + reward, lastDailyClaimDate: today, lastDailyClaimAt: now, dailyStreak: streak, achievements });
    return { ok: true, reward };
  },
  buySkin: id => {
    const state = get();
    const skin = SKINS.find(item => item.id === id);
    if (!skin) return { ok: false, reason: 'missing' };
    if (state.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
    if (skin.unlock && skin.unlock.type !== 'free') return { ok: false, reason: 'unlock' };
    if (state.coins < skin.price) return { ok: false, reason: 'coins' };
    set({ coins: state.coins - skin.price, ownedSkins: [...state.ownedSkins, id], equippedSkin: id });
    return { ok: true };
  },
  claimSkinReward: id => {
    const state = get();
    const skin = SKINS.find(item => item.id === id);
    if (!skin || !skin.unlock || !meetsUnlockRequirement(skin, state)) return { ok: false, reason: 'locked' };
    if (state.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
    set({ ownedSkins: [...state.ownedSkins, id], equippedSkin: id });
    return { ok: true };
  },
  equipSkin: id => set(state => state.ownedSkins.includes(id) ? { equippedSkin: id } : {}),
  buyCosmetic: (type, id) => {
    const state = get();
    const catalog = type === 'hat' ? HATS : TRAIL_EFFECTS;
    const ownedKey = type === 'hat' ? 'ownedHats' : 'ownedTrails';
    const equippedKey = type === 'hat' ? 'equippedHat' : 'equippedTrail';
    const item = catalog.find(entry => entry.id === id);
    if (!item) return { ok: false, reason: 'missing' };
    if (state[ownedKey].includes(id)) return { ok: false, reason: 'owned' };
    if (state.coins < item.price) return { ok: false, reason: 'coins' };
    set({ coins: state.coins - item.price, [ownedKey]: [...state[ownedKey], id], [equippedKey]: id });
    return { ok: true };
  },
  equipCosmetic: (type, id) => {
    const ownedKey = type === 'hat' ? 'ownedHats' : 'ownedTrails';
    const equippedKey = type === 'hat' ? 'equippedHat' : 'equippedTrail';
    set(state => state[ownedKey].includes(id) ? { [equippedKey]: id } : {});
  }
}), {
  name: 'paper-io-meta',
  version: 2,
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({
    selectedMap: state.selectedMap, coins: state.coins, ownedSkins: state.ownedSkins, equippedSkin: state.equippedSkin,
    ownedHats: state.ownedHats, equippedHat: state.equippedHat, ownedTrails: state.ownedTrails, equippedTrail: state.equippedTrail,
    achievements: state.achievements, lastDailyClaimDate: state.lastDailyClaimDate, lastDailyClaimAt: state.lastDailyClaimAt,
    dailyStreak: state.dailyStreak, bestTerritory: state.bestTerritory, roundsPlayed: state.roundsPlayed,
    selectedMode: state.selectedMode, modeRecords: state.modeRecords
  }),
  migrate: saved => {
    saved = saved && typeof saved === 'object' ? saved : {};
    const valid = (items, catalog, fallback) => Array.isArray(items) ? [...new Set([fallback, ...items.filter(id => catalog.some(item => item.id === id))])] : [fallback];
    return {
      ...base, ...saved,
      coins: Number.isFinite(saved.coins) ? Math.max(0, saved.coins) : 0,
      ownedSkins: valid(saved.ownedSkins, SKINS, 'classic'),
      equippedSkin: SKINS.some(item => item.id === saved.equippedSkin) && valid(saved.ownedSkins, SKINS, 'classic').includes(saved.equippedSkin) ? saved.equippedSkin : 'classic',
      ownedHats: valid(saved.ownedHats, HATS, 'none'),
      equippedHat: HATS.some(item => item.id === saved.equippedHat) && valid(saved.ownedHats, HATS, 'none').includes(saved.equippedHat) ? saved.equippedHat : 'none',
      ownedTrails: valid(saved.ownedTrails, TRAIL_EFFECTS, 'none'),
      equippedTrail: TRAIL_EFFECTS.some(item => item.id === saved.equippedTrail) && valid(saved.ownedTrails, TRAIL_EFFECTS, 'none').includes(saved.equippedTrail) ? saved.equippedTrail : 'none',
      achievements: Array.isArray(saved.achievements) ? [...new Set(saved.achievements)] : [],
      modeRecords: saved.modeRecords && typeof saved.modeRecords === 'object' ? saved.modeRecords : {},
      selectedMode: saved.selectedMode === 'sprint' ? 'sprint' : 'classic'
    };
  },
  merge: (saved, current) => ({ ...current, ...saved })
}));
