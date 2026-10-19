export const WORLD_COUNTRIES = Object.freeze([
  { id: 'ukraine', flag: '🇺🇦', name: { ru: 'Украина', en: 'Ukraine' }, mapId: 'circle', target: 90 },
  { id: 'france', flag: '🇫🇷', name: { ru: 'Франция', en: 'France' }, mapId: 'hexagon', target: 90 },
  { id: 'japan', flag: '🇯🇵', name: { ru: 'Япония', en: 'Japan' }, mapId: 'diamond', target: 90 },
  { id: 'brazil', flag: '🇧🇷', name: { ru: 'Бразилия', en: 'Brazil' }, mapId: 'heart', target: 90 },
  { id: 'canada', flag: '🇨🇦', name: { ru: 'Канада', en: 'Canada' }, mapId: 'star', target: 90 },
  { id: 'egypt', flag: '🇪🇬', name: { ru: 'Египет', en: 'Egypt' }, mapId: 'cross', target: 90 },
  { id: 'australia', flag: '🇦🇺', name: { ru: 'Австралия', en: 'Australia' }, mapId: 'clover', target: 90 },
  { id: 'france-elite', flag: '🏆', name: { ru: 'Финал чемпионов', en: 'Champions finale' }, mapId: 'crown', target: 90 }
]);

export const DEFAULT_WORLD_PROGRESS = Object.freeze({
  completed: [],
  selectedCountryId: 'ukraine',
  prestige: 0,
  experience: 0,
  level: 1,
  gamesPlayed: 0,
  totalTerritory: 0,
  bestTerritory: 0,
  countryRecords: {},
  rank: 'recruit'
});

export function getPlayerLevel(experience) {
  const xp = Math.max(0, Number(experience) || 0);
  let level = 1;
  let next = 100;
  let remaining = xp;
  while (remaining >= next && level < 100) {
    remaining -= next;
    level += 1;
    next = level * 100;
  }
  return level;
}

export function getPlayerRank(gamesPlayed, bestTerritory, prestige = 0) {
  const games = Math.max(0, Number(gamesPlayed) || 0);
  const best = Math.max(0, Number(bestTerritory) || 0);
  if (prestige >= 3) return 'legend';
  if (games >= 100 || best >= 90) return 'champion';
  if (games >= 50 || best >= 60) return 'veteran';
  if (games >= 20 || best >= 30) return 'captain';
  if (games >= 5 || best >= 10) return 'explorer';
  return 'recruit';
}

export function isCountryUnlocked(countryId, completed = [], countries = WORLD_COUNTRIES) {
  const index = countries.findIndex(country => country.id === countryId);
  if (index < 0) return false;
  if (index === 0) return true;
  return completed.includes(countries[index - 1].id);
}

export function advanceWorldProgress(progress, { countryId = 'ukraine', territory = 0, experience = 0 } = {}, countries = WORLD_COUNTRIES) {
  const current = { ...DEFAULT_WORLD_PROGRESS, ...progress };
  const completed = [...new Set(current.completed || [])];
  const countryRecords = { ...(current.countryRecords || {}) };
  const country = countries.find(item => item.id === countryId);
  const percent = Math.max(0, Math.min(100, Number(territory) || 0));
  const xpGained = Math.max(0, Math.floor(Number(experience) || 0));
  const gamesPlayed = (Number(current.gamesPlayed) || 0) + 1;
  const totalTerritory = (Number(current.totalTerritory) || 0) + percent;
  const bestTerritory = Math.max(Number(current.bestTerritory) || 0, percent);
  if (country) {
    countryRecords[countryId] = Math.max(Number(countryRecords[countryId]) || 0, percent);
    if (percent >= (country.target || 90) && !completed.includes(countryId)) completed.push(countryId);
  }
  let prestige = Math.max(0, Number(current.prestige) || 0);
  let selectedCountryId = current.selectedCountryId;
  if (countries.length && countries.every(item => completed.includes(item.id))) {
    prestige += 1;
    completed.splice(0, completed.length);
    selectedCountryId = countries[0].id;
  } else if (!isCountryUnlocked(selectedCountryId, completed, countries)) {
    selectedCountryId = countries.find(item => isCountryUnlocked(item.id, completed, countries))?.id || countries[0]?.id;
  }
  const totalExperience = Math.max(0, Number(current.experience) || 0) + xpGained;
  return {
    ...current, completed, countryRecords, selectedCountryId, prestige, experience: totalExperience,
    level: getPlayerLevel(totalExperience), gamesPlayed, totalTerritory, bestTerritory,
    rank: getPlayerRank(gamesPlayed, bestTerritory, prestige), lastExperienceGained: xpGained
  };
}
