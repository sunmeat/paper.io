import { describe, expect, it } from 'vitest';
import { HATS, RARITY, SKINS, TRAIL_EFFECTS, getSkinById } from './skins.js';
import { getPlayerColor, PLAYER_PALETTE } from './playerPalette.js';

function rgb(hex) {
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

function distance(left, right) {
  const a = rgb(left), b = rgb(right);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

describe('cosmetic catalog', () => {
  it('contains at least fourteen priced and patterned skins', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(14);
    for (const skin of SKINS) {
      expect(skin.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof skin.price).toBe('number');
      expect(['common', 'rare', 'epic']).toContain(skin.rarity);
      expect(typeof skin.pattern).toBe('string');
    }
  });

  it('keeps hats and trail effects as separate cosmetic slots', () => {
    expect(HATS.some(hat => hat.id === 'none')).toBe(true);
    expect(TRAIL_EFFECTS.some(effect => effect.id === 'none')).toBe(true);
    expect(HATS.length).toBeGreaterThan(1);
    expect(TRAIL_EFFECTS.length).toBeGreaterThan(1);
  });

  it('provides free unlock requirements for progression rewards', () => {
    expect(SKINS.some(skin => skin.unlock?.type === 'level')).toBe(true);
    expect(SKINS.some(skin => skin.unlock?.type === 'quest')).toBe(true);
    expect(SKINS.some(skin => skin.unlock?.type === 'achievement')).toBe(true);
  });

  it('falls back to classic for unknown skin ids', () => {
    expect(getSkinById('not-a-skin').id).toBe('classic');
  });

  it('chooses bot colors with a visible distance from the equipped skin', () => {
    for (const skin of SKINS) {
      const candidates = Array.from({ length: 11 }, (_, index) => getPlayerColor(index + 2, skin.color));
      for (const color of candidates) {
        expect(PLAYER_PALETTE).toContain(color);
        expect(distance(color, skin.color)).toBeGreaterThanOrEqual(125);
      }
    }
  });

  it('defines all rarity labels and frame colors', () => {
    expect(Object.keys(RARITY)).toEqual(['common', 'rare', 'epic']);
    for (const rarity of Object.values(RARITY)) expect(rarity.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
