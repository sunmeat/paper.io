import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORLD_PROGRESS,
  advanceWorldProgress,
  getPlayerLevel,
  getPlayerRank,
  isCountryUnlocked,
  restoreWorldProgress,
  WORLD_COUNTRIES
} from './world.js';

describe('country world progression', () => {
  it('opens the next country only after reaching 90% in one round', () => {
    const start = { ...DEFAULT_WORLD_PROGRESS, completed: [] };
    const shortRound = advanceWorldProgress(start, { countryId: 'ukraine', territory: 89.999, experience: 20 });
    expect(shortRound.completed).not.toContain('ukraine');
    expect(isCountryUnlocked('france', shortRound.completed)).toBe(false);

    const completed = advanceWorldProgress(shortRound, { countryId: 'ukraine', territory: 90, experience: 200 });
    expect(completed.completed).toContain('ukraine');
    expect(isCountryUnlocked('france', completed.completed)).toBe(true);
    expect(completed.countryRecords.ukraine).toBe(90);
  });

  it('serializes and restores progression without losing unlocks or records', () => {
    const progress = advanceWorldProgress(
      { ...DEFAULT_WORLD_PROGRESS, completed: [] },
      { countryId: 'ukraine', territory: 93.125, experience: 220 }
    );
    const restored = restoreWorldProgress(JSON.parse(JSON.stringify(progress)));
    expect(restored.completedCountries).toEqual(['ukraine']);
    expect(restored.countryRecords.ukraine).toBe(93.125);
    expect(restored.experience).toBe(220);
    const next = advanceWorldProgress({ ...restored, completed: restored.completedCountries }, { countryId: 'france', territory: 90, experience: 100 });
    expect(next.completed).toEqual(['ukraine', 'france']);
    expect(next.gamesPlayed).toBe(2);
  });

  it('levels up from earned experience and assigns ranks from total stats', () => {
    expect(getPlayerLevel(0)).toBe(1);
    expect(getPlayerLevel(100)).toBe(2);
    expect(getPlayerLevel(300)).toBe(3);
    expect(getPlayerRank(0, 0)).toBe('recruit');
    expect(getPlayerRank(20, 5)).toBe('captain');
    expect(getPlayerRank(100, 90)).toBe('champion');
  });

  it('restarts the world at higher prestige after the finale', () => {
    const completed = WORLD_COUNTRIES.map(country => country.id);
    const progress = { ...DEFAULT_WORLD_PROGRESS, completed, selectedCountryId: WORLD_COUNTRIES.at(-1).id, prestige: 0 };
    const replay = advanceWorldProgress(progress, { countryId: WORLD_COUNTRIES.at(-1).id, territory: 95, experience: 50 });
    expect(replay.prestige).toBe(1);
    expect(replay.completed).toEqual([]);
    expect(replay.selectedCountryId).toBe(WORLD_COUNTRIES[0].id);
    expect(isCountryUnlocked(WORLD_COUNTRIES[0].id, replay.completed)).toBe(true);
    expect(isCountryUnlocked(WORLD_COUNTRIES[1].id, replay.completed)).toBe(false);
  });
});
