import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { HATS, isUnlocked, SKINS, TRAIL_EFFECTS } from '../engine/skins.js';
import { mulberry32 } from '../engine/random.js';
import { DEFAULT_WORLD_PROGRESS, advanceWorldProgress, isCountryUnlocked, restoreWorldProgress, WORLD_COUNTRIES } from '../engine/world.js';

const walletChecksum = coins => {
  const value = Math.max(0, Math.floor(Number(coins) || 0));
  let hash = 2166136261;
  for (const char of `paper-io-wallet-v1:${value}:arena`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
};

export const getDailyQuests = (date = new Date()) => {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const random = mulberry32(day ^ 0x51f15e);
  const pool = [
    { id: 'kills-3', type: 'kills', target: 3, reward: 90 },
    { id: 'territory-30', type: 'territory', target: 30, reward: 110 },
    { id: 'play-1', type: 'rounds', target: 1, reward: 60 },
    { id: 'kills-5', type: 'kills', target: 5, reward: 140 },
    { id: 'territory-50', type: 'territory', target: 50, reward: 160 },
    { id: 'sprint-1', type: 'sprint', target: 1, reward: 100 }
  ];
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, 2);
};

const base = {
  selectedMap: 'circle',
  coins: 0,
  revivesPurchased: 0,
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
  totalKills: 0,
  bestRoundKills: 0,
  bestRoundTerritory: 0,
  wins: 0,
  winStreak: 0,
  sprintWins: 0,
  lastRoundKills: 0,
  lastRoundTerritory: 0,
  lastMode: 'classic',
  roundsPlayed: 0,
  selectedMode: 'classic',
  modeRecords: {},
  dailyQuestProgress: {},
  dailyQuestClaims: {},
  walletChecksum: walletChecksum(0),
  totalRoundCoins: 0,
  ...DEFAULT_WORLD_PROGRESS,
  completedCountries: []
};

const dateKey = (date = new Date()) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

const snapshot = { territory: 0, score: 0, sessionScore: 0, bots: 10, over: false, paused: false, respawning: false, top5: [] };

const meetsUnlockRequirement = (item, state) => isUnlocked(item, state);

export const useGameStore = create(persist((set, get) => ({
  screen: 'menu',
  paused: false,
  selectedMap: 'circle',
  selectedMode: 'classic',
  setSelectedMode: modeId => set({ selectedMode: modeId === 'sprint' ? 'sprint' : 'classic' }),
  setSelectedMap: selectedMap => set({ selectedMap }),
  setSelectedCountry: countryId => set(state => isCountryUnlocked(countryId, state.completedCountries, WORLD_COUNTRIES) ? { selectedCountryId: countryId, selectedMap: WORLD_COUNTRIES.find(country => country.id === countryId)?.mapId || 'circle' } : {}),
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
    if (nextSnapshot.leaderId === 1 && !achievements.includes('first-leader')) achievements.push('first-leader');
    if ((Number(nextSnapshot.sessionScore) || 0) > 0 && !achievements.includes('first-capture')) achievements.push('first-capture');
    return { snapshot: nextSnapshot, achievements };
  }),
  resetSnapshot: () => set({ snapshot, paused: false }),
  addCoins: amount => set(state => { const coins = state.coins + Math.max(0, Math.floor(amount || 0)); return { coins, walletChecksum: walletChecksum(coins) }; }),
  getRevivePrice: () => get().revivesPurchased > 0 ? 200 : 100,
  spendCoinsForRevive: () => {
    const state = get();
    const price = state.revivesPurchased > 0 ? 200 : 100;
    if (state.coins < price) return { ok: false, reason: 'coins', price };
    const coins = state.coins - price;
    set({ coins, walletChecksum: walletChecksum(coins), revivesPurchased: state.revivesPurchased + 1 });
    return { ok: true, price };
  },
  awardAchievement: id => set(state => state.achievements.includes(id) ? {} : { achievements: [...state.achievements, id] }),
  finishRound: () => set(state => {
    const achievements = [...state.achievements];
    const round = state.snapshot || {};
    const roundsPlayed = state.roundsPlayed + 1;
    const territory = Math.max(0, Number(round.maxTerritory ?? round.territory) || 0);
    const kills = Math.max(0, Number(round.kills) || 0);
    const elapsedMs = Math.max(0, Number(round.roundTimeMs ?? round.elapsedMs) || 0);
    const victory = round.outcome === 'victory';
    const roundCoinsEarned = Math.max(10, 10 + Math.floor(territory * 2) + kills * 35 + Math.min(50, Math.floor(elapsedMs / 60000) * 5) + (victory ? 75 : 0) + (round.secretConquered && victory ? 500 : 0));
    const coins = state.coins + roundCoinsEarned;
    const totalRoundCoins = (Number(state.totalRoundCoins) || 0) + roundCoinsEarned;
    const today = dateKey();
    const dailyQuestProgress = { ...(state.dailyQuestProgress || {}) };
    const previous = dailyQuestProgress[today] || {};
    const modeId = round.modeId || state.selectedMode || 'classic';
    for (const quest of getDailyQuests()) {
      const value = quest.type === 'kills' ? kills : quest.type === 'territory' ? territory : quest.type === 'sprint' ? (modeId === 'sprint' ? 1 : 0) : 1;
      dailyQuestProgress[today][quest.id] = Math.max(Number(previous[quest.id]) || 0, value);
    }
    const countryId = round.countryId || state.selectedCountryId || 'ukraine';
    const xpGained = Math.max(10, Math.floor(territory * 2) + kills * 15 + (victory ? 50 : 0));
    const worldProgress = advanceWorldProgress({ completed: state.completedCountries || [], selectedCountryId: state.selectedCountryId || 'ukraine', prestige: state.prestige || 0, experience: state.experience || 0, level: state.level || 1, gamesPlayed: state.gamesPlayed || 0, totalTerritory: state.totalTerritory || 0, bestTerritory: state.bestTerritory || 0, countryRecords: state.countryRecords || {}, rank: state.rank || 'recruit' }, { countryId, territory, experience: xpGained });
    const modeRecords = { ...(state.modeRecords || {}) };
    const totalKills = (Number(state.totalKills) || 0) + kills;
    const bestRoundKills = Math.max(Number(state.bestRoundKills) || 0, kills);
    const bestRoundTerritory = Math.max(Number(state.bestRoundTerritory) || 0, territory);
    const wins = (Number(state.wins) || 0) + (victory ? 1 : 0);
    const winStreak = victory ? (Number(state.winStreak) || 0) + 1 : 0;
    const sprintWins = (Number(state.sprintWins) || 0) + (modeId === 'sprint' && victory ? 1 : 0);
    if (!achievements.includes('first-round')) achievements.push('first-round');
    if (roundsPlayed >= 10 && !achievements.includes('rounds-10')) achievements.push('rounds-10');
    if (kills >= 3 && !achievements.includes('killer-3')) achievements.push('killer-3');
    if (territory >= 30 && !achievements.includes('territory-30')) achievements.push('territory-30');
    if (totalKills >= 25 && !achievements.includes('kills-25')) achievements.push('kills-25');
    if (territory >= 75 && !achievements.includes('territory-75')) achievements.push('territory-75');
    if (totalRoundCoins >= 1000 && !achievements.includes('coins-1000')) achievements.push('coins-1000');
    if (modeId === 'sprint' && territory >= 20 && !achievements.includes('sprint-winner')) achievements.push('sprint-winner');
    modeRecords[modeId] = Math.max(Number(modeRecords[modeId]) || 0, territory);
    const profile = {
      ...state, achievements, level: worldProgress.level, completedCountries: worldProgress.completed,
      totalTerritory: worldProgress.totalTerritory, roundTerritory: territory, lastRoundTerritory: territory,
      roundKills: kills, lastRoundKills: kills, totalKills, bestRoundKills, bestRoundTerritory,
      wins, winStreak, sprintWins, lastMode: modeId
    };
    const newlyUnlockedItems = [];
    const ownedSkins = [...(state.ownedSkins || [])];
    const ownedHats = [...(state.ownedHats || [])];
    const ownedTrails = [...(state.ownedTrails || [])];
    for (const [kind, catalog, owned] of [
      ['skin', SKINS, ownedSkins], ['hat', HATS, ownedHats], ['trail', TRAIL_EFFECTS, ownedTrails]
    ]) {
      for (const item of catalog) {
        if (!item.unlock || item.unlock.type === 'free' || owned.includes(item.id) || !isUnlocked(item, profile)) continue;
        owned.push(item.id);
        newlyUnlockedItems.push({ id: item.id, kind, name: item.name, icon: item.icon || (kind === 'skin' ? '●' : '✦'), color: item.color || (kind === 'skin' ? item.color : null), rarity: item.rarity });
      }
    }
    return {
      roundsPlayed, coins, walletChecksum: walletChecksum(coins), totalRoundCoins, dailyQuestProgress,
      totalKills, bestRoundKills, bestRoundTerritory, wins, winStreak, sprintWins,
      lastRoundKills: kills, lastRoundTerritory: territory, lastMode: modeId,
      ownedSkins, ownedHats, ownedTrails,
      completedCountries: worldProgress.completed, selectedCountryId: worldProgress.selectedCountryId, prestige: worldProgress.prestige, experience: worldProgress.experience, level: worldProgress.level, gamesPlayed: worldProgress.gamesPlayed, totalTerritory: worldProgress.totalTerritory, bestTerritory: worldProgress.bestTerritory, countryRecords: worldProgress.countryRecords, rank: worldProgress.rank, lastExperienceGained: xpGained, selectedMap: WORLD_COUNTRIES.find(country => country.id === worldProgress.selectedCountryId)?.mapId || state.selectedMap,
      snapshot: { ...round, roundCoinsEarned, experienceGained: xpGained, newlyUnlockedItems },
      modeRecords, achievements
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
    const coins = state.coins + reward;
    set({ coins, walletChecksum: walletChecksum(coins), lastDailyClaimDate: today, lastDailyClaimAt: now, dailyStreak: streak, achievements });
    return { ok: true, reward };
  },
  buySkin: id => {
    const state = get();
    const skin = SKINS.find(item => item.id === id);
    if (!skin) return { ok: false, reason: 'missing' };
    if (state.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
    if (skin.unlock && skin.unlock.type !== 'free') return { ok: false, reason: 'unlock' };
    if (state.coins < skin.price) return { ok: false, reason: 'coins' };
    const coins = state.coins - skin.price;
    set({ coins, walletChecksum: walletChecksum(coins), ownedSkins: [...state.ownedSkins, id], equippedSkin: id });
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
    if (item.unlock && item.unlock.type !== 'free') return { ok: false, reason: 'unlock' };
    if (state.coins < item.price) return { ok: false, reason: 'coins' };
    const coins = state.coins - item.price;
    set({ coins, walletChecksum: walletChecksum(coins), [ownedKey]: [...state[ownedKey], id], [equippedKey]: id });
    return { ok: true };
  },
  claimDailyQuest: id => {
    const state = get();
    const today = dateKey();
    const quest = getDailyQuests().find(item => item.id === id);
    const progress = Number(state.dailyQuestProgress?.[today]?.[id]) || 0;
    const claims = { ...(state.dailyQuestClaims || {}) };
    const todayClaims = [...(claims[today] || [])];
    if (!quest || progress < quest.target || todayClaims.includes(id)) return { ok: false };
    todayClaims.push(id); claims[today] = todayClaims;
    const coins = state.coins + quest.reward;
    set({ coins, walletChecksum: walletChecksum(coins), dailyQuestClaims: claims });
    return { ok: true, reward: quest.reward };
  },
  equipCosmetic: (type, id) => {
    const ownedKey = type === 'hat' ? 'ownedHats' : 'ownedTrails';
    const equippedKey = type === 'hat' ? 'equippedHat' : 'equippedTrail';
    set(state => state[ownedKey].includes(id) ? { [equippedKey]: id } : {});
  }
}), {
  name: 'paper-io-meta',
  version: 4,
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({
    selectedMap: state.selectedMap, coins: state.coins, revivesPurchased: state.revivesPurchased, ownedSkins: state.ownedSkins, equippedSkin: state.equippedSkin,
    ownedHats: state.ownedHats, equippedHat: state.equippedHat, ownedTrails: state.ownedTrails, equippedTrail: state.equippedTrail,
    achievements: state.achievements, lastDailyClaimDate: state.lastDailyClaimDate, lastDailyClaimAt: state.lastDailyClaimAt,
    dailyStreak: state.dailyStreak, roundsPlayed: state.roundsPlayed,
    totalKills: state.totalKills, bestRoundKills: state.bestRoundKills, bestRoundTerritory: state.bestRoundTerritory,
    wins: state.wins, winStreak: state.winStreak, sprintWins: state.sprintWins,
    lastRoundKills: state.lastRoundKills, lastRoundTerritory: state.lastRoundTerritory, lastMode: state.lastMode,
    selectedMode: state.selectedMode, modeRecords: state.modeRecords, dailyQuestProgress: state.dailyQuestProgress, dailyQuestClaims: state.dailyQuestClaims, walletChecksum: state.walletChecksum, totalRoundCoins: state.totalRoundCoins,
    completedCountries: state.completedCountries, selectedCountryId: state.selectedCountryId, prestige: state.prestige, experience: state.experience, level: state.level, gamesPlayed: state.gamesPlayed, totalTerritory: state.totalTerritory, bestTerritory: state.bestTerritory, countryRecords: state.countryRecords, rank: state.rank, lastExperienceGained: state.lastExperienceGained
  }),
  migrate: saved => {
    saved = saved && typeof saved === 'object' ? saved : {};
    const valid = (items, catalog, fallback) => Array.isArray(items) ? [...new Set([fallback, ...items.filter(id => catalog.some(item => item.id === id))])] : [fallback];
    return {
      ...base, ...saved,
      coins: saved.walletChecksum && saved.walletChecksum === walletChecksum(saved.coins) ? Math.max(0, Math.floor(Number(saved.coins) || 0)) : (saved.walletChecksum ? 0 : Math.max(0, Math.floor(Number(saved.coins) || 0))),
      walletChecksum: walletChecksum(saved.walletChecksum && saved.walletChecksum === walletChecksum(saved.coins) ? saved.coins : (saved.walletChecksum ? 0 : saved.coins)),
      totalRoundCoins: Math.max(0, Number(saved.totalRoundCoins) || 0),
      totalKills: Math.max(0, Number(saved.totalKills) || 0),
      bestRoundKills: Math.max(0, Number(saved.bestRoundKills) || 0),
      bestRoundTerritory: Math.max(0, Number(saved.bestRoundTerritory) || 0),
      wins: Math.max(0, Number(saved.wins) || 0),
      winStreak: Math.max(0, Number(saved.winStreak) || 0),
      sprintWins: Math.max(0, Number(saved.sprintWins) || 0),
      lastRoundKills: Math.max(0, Number(saved.lastRoundKills) || 0),
      lastRoundTerritory: Math.max(0, Number(saved.lastRoundTerritory) || 0),
      lastMode: saved.lastMode === 'sprint' ? 'sprint' : 'classic',
      revivesPurchased: Math.max(0, Math.floor(Number(saved.revivesPurchased) || 0)),
      dailyQuestProgress: saved.dailyQuestProgress && typeof saved.dailyQuestProgress === 'object' ? saved.dailyQuestProgress : {},
      dailyQuestClaims: saved.dailyQuestClaims && typeof saved.dailyQuestClaims === 'object' ? saved.dailyQuestClaims : {},
      ownedSkins: valid(saved.ownedSkins, SKINS, 'classic'),
      equippedSkin: SKINS.some(item => item.id === saved.equippedSkin) && valid(saved.ownedSkins, SKINS, 'classic').includes(saved.equippedSkin) ? saved.equippedSkin : 'classic',
      ownedHats: valid(saved.ownedHats, HATS, 'none'),
      equippedHat: HATS.some(item => item.id === saved.equippedHat) && valid(saved.ownedHats, HATS, 'none').includes(saved.equippedHat) ? saved.equippedHat : 'none',
      ownedTrails: valid(saved.ownedTrails, TRAIL_EFFECTS, 'none'),
      equippedTrail: TRAIL_EFFECTS.some(item => item.id === saved.equippedTrail) && valid(saved.ownedTrails, TRAIL_EFFECTS, 'none').includes(saved.equippedTrail) ? saved.equippedTrail : 'none',
      achievements: Array.isArray(saved.achievements) ? [...new Set(saved.achievements)] : [],
      modeRecords: saved.modeRecords && typeof saved.modeRecords === 'object' ? saved.modeRecords : {},
      selectedMode: saved.selectedMode === 'sprint' ? 'sprint' : 'classic',
      ...restoreWorldProgress(saved),
      selectedMap: WORLD_COUNTRIES.find(country => country.id === restoreWorldProgress(saved).selectedCountryId)?.mapId || 'circle'
    };
  },
  merge: (saved, current) => { const valid = Boolean(saved && saved.walletChecksum && saved.walletChecksum === walletChecksum(saved.coins)); const coins = valid ? Math.max(0, Math.floor(Number(saved.coins) || 0)) : 0; return { ...current, ...saved, coins, walletChecksum: walletChecksum(coins) }; }
}));
