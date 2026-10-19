export const RARITY = Object.freeze({
  common: { ru: 'Обычный', en: 'Common', color: '#9ca3b8' },
  rare: { ru: 'Редкий', en: 'Rare', color: '#59a8ff' },
  epic: { ru: 'Эпический', en: 'Epic', color: '#c084fc' }
});

export const SKINS = Object.freeze([
  { id: 'classic', name: { ru: 'Классика', en: 'Classic' }, price: 0, color: '#9b7bff', pattern: 'solid', trailShape: 'square', rarity: 'common', unlock: { type: 'free' } },
  { id: 'neon', name: { ru: 'Неон', en: 'Neon' }, price: 150, color: '#e7ff45', pattern: 'dots', trailShape: 'circle', rarity: 'common' },
  { id: 'coral', name: { ru: 'Коралл', en: 'Coral' }, price: 300, color: '#ff6685', pattern: 'stripes', trailShape: 'diamond', rarity: 'common' },
  { id: 'ice', name: { ru: 'Лёд', en: 'Ice' }, price: 500, color: '#65dfff', pattern: 'grid', trailShape: 'square', rarity: 'rare' },
  { id: 'royal', name: { ru: 'Королевский', en: 'Royal' }, price: 800, color: '#ffbd59', pattern: 'rings', trailShape: 'circle', rarity: 'epic' },
  { id: 'mint', name: { ru: 'Мята', en: 'Mint' }, price: 0, color: '#58e6ad', pattern: 'diagonal', trailShape: 'square', rarity: 'common', unlock: { type: 'quest', captured: 100 } },
  { id: 'sunset', name: { ru: 'Закат', en: 'Sunset' }, price: 0, color: '#ff895e', pattern: 'solid', trailShape: 'diamond', rarity: 'common', unlock: { type: 'achievement', id: 'first-capture' } },
  { id: 'pixel', name: { ru: 'Пиксель', en: 'Pixel' }, price: 0, color: '#8ca7ff', pattern: 'pixels', trailShape: 'square', rarity: 'rare', unlock: { type: 'level', level: 3 } },
  { id: 'lava', name: { ru: 'Лава', en: 'Lava' }, price: 600, color: '#ff704d', pattern: 'diagonal', trailShape: 'diamond', rarity: 'rare' },
  { id: 'galaxy', name: { ru: 'Галактика', en: 'Galaxy' }, price: 1000, color: '#e18cff', pattern: 'stars', trailShape: 'circle', rarity: 'epic' },
  { id: 'matrix', name: { ru: 'Матрица', en: 'Matrix' }, price: 700, color: '#a7ef58', pattern: 'pixels', trailShape: 'square', rarity: 'rare' },
  { id: 'candy', name: { ru: 'Конфета', en: 'Candy' }, price: 450, color: '#ff91cf', pattern: 'stripes', trailShape: 'circle', rarity: 'common' },
  { id: 'toxic', name: { ru: 'Токсик', en: 'Toxic' }, price: 0, color: '#c5f34a', pattern: 'dots', trailShape: 'diamond', rarity: 'epic', unlock: { type: 'level', level: 5 } },
  { id: 'gold', name: { ru: 'Золото', en: 'Gold' }, price: 2000, color: '#f5d76e', pattern: 'rings', trailShape: 'circle', rarity: 'epic' }
]);

export const HATS = Object.freeze([
  { id: 'none', name: { ru: 'Без шапки', en: 'No hat' }, price: 0, icon: '', rarity: 'common' },
  { id: 'crown', name: { ru: 'Корона', en: 'Crown' }, price: 450, icon: '♛', rarity: 'epic' },
  { id: 'cap', name: { ru: 'Кепка', en: 'Cap' }, price: 120, icon: '▰', rarity: 'common' },
  { id: 'halo', name: { ru: 'Нимб', en: 'Halo' }, price: 300, icon: '◯', rarity: 'rare' },
  { id: 'party', name: { ru: 'Колпак', en: 'Party hat' }, price: 180, icon: '▲', rarity: 'common' }
]);

export const TRAIL_EFFECTS = Object.freeze([
  { id: 'none', name: { ru: 'Обычный', en: 'Default' }, price: 0, color: null, rarity: 'common' },
  { id: 'glow', name: { ru: 'Свечение', en: 'Glow' }, price: 200, color: '#d8c9ff', rarity: 'common' },
  { id: 'spark', name: { ru: 'Искры', en: 'Sparks' }, price: 350, color: '#ffe28a', rarity: 'rare' },
  { id: 'comet', name: { ru: 'Комета', en: 'Comet' }, price: 650, color: '#8cecff', rarity: 'epic' }
]);

export const getSkinById = id => SKINS.find(skin => skin.id === id) || SKINS[0];
export const getHatById = id => HATS.find(hat => hat.id === id) || HATS[0];
export const getTrailById = id => TRAIL_EFFECTS.find(effect => effect.id === id) || TRAIL_EFFECTS[0];
