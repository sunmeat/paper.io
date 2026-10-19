export const MAPS = Object.freeze([
  { id: 'circle', name: { ru: 'Круг', en: 'Circle' } },
  { id: 'star', name: { ru: 'Звезда', en: 'Star' } },
  { id: 'heart', name: { ru: 'Сердце', en: 'Heart' } },
  { id: 'crown', name: { ru: 'Корона', en: 'Crown' } },
  { id: 'diamond', name: { ru: 'Алмаз', en: 'Diamond' } },
  { id: 'hexagon', name: { ru: 'Гексагон', en: 'Hexagon' } },
  { id: 'cross', name: { ru: 'Крест', en: 'Cross' } },
  { id: 'island', name: { ru: 'Остров', en: 'Island' } },
  { id: 'archipelago', name: { ru: 'Архипелаг', en: 'Archipelago' } },
  { id: 'clover', name: { ru: 'Клевер', en: 'Clover' } }
]);

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonPoints(kind) {
  if (kind === 'star') return Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? 0.25 : 0.47;
    return [0.5 + Math.cos(angle) * radius, 0.5 + Math.sin(angle) * radius];
  });
  if (kind === 'crown') return [[0.08,0.25],[0.28,0.43],[0.38,0.13],[0.52,0.4],[0.68,0.12],[0.78,0.43],[0.94,0.23],[0.84,0.84],[0.16,0.84]];
  if (kind === 'diamond') return [[0.5,0.04],[0.94,0.5],[0.5,0.96],[0.06,0.5]];
  if (kind === 'hexagon') return Array.from({ length: 6 }, (_, i) => {
    const angle = -Math.PI / 6 + i * Math.PI / 3;
    return [0.5 + Math.cos(angle) * 0.46, 0.5 + Math.sin(angle) * 0.46];
  });
  if (kind === 'cross') return [[0.36,0.06],[0.64,0.06],[0.64,0.36],[0.94,0.36],[0.94,0.64],[0.64,0.64],[0.64,0.94],[0.36,0.94],[0.36,0.64],[0.06,0.64],[0.06,0.36],[0.36,0.36]];
  return null;
}

function insideShape(kind, nx, ny) {
  const dx = nx - 0.5;
  const dy = ny - 0.5;
  const polygon = polygonPoints(kind);
  if (polygon) return pointInPolygon(nx, ny, polygon);
  if (kind === 'heart') {
    const x = (nx - 0.5) * 2.6;
    const y = (0.38 - ny) * 2.6;
    return (x * x + y * y - 1) ** 3 - x * x * y ** 3 <= 0;
  }
  if (kind === 'island') return dx * dx / 0.22 + dy * dy / 0.18 <= 1;
  if (kind === 'archipelago') {
    return [[0.3,0.3,0.13],[0.62,0.26,0.12],[0.48,0.54,0.14],[0.72,0.68,0.16],[0.3,0.76,0.11]].some(([cx,cy,r]) => ((nx-cx)**2+(ny-cy)**2)/(r*r) <= 1);
  }
  if (kind === 'clover') {
    return [[0.36,0.36],[0.64,0.36],[0.36,0.64],[0.64,0.64]].some(([cx,cy]) => (nx-cx)**2+(ny-cy)**2 <= 0.16**2);
  }
  return dx * dx / 0.225 + dy * dy / 0.225 <= 1;
}

export function createMapMask(width, height, mapId = 'circle') {
  const selected = MAPS.some(map => map.id === mapId) ? mapId : 'circle';
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      mask[y * width + x] = insideShape(selected, (x + 0.5) / width, (y + 0.5) / height) ? 1 : 0;
    }
  }
  return mask;
}

export function getMapPreview(mapId, size = 9) {
  return Array.from(createMapMask(size, size, mapId));
}
