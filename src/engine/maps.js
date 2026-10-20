export const MAPS = Object.freeze([
  { id: 'ukraine', name: { ru: 'Украина · границы 1991 года', en: 'Ukraine · 1991 borders' } },
  { id: 'circle', name: { ru: 'Круг', en: 'Circle' } },
  { id: 'star', name: { ru: 'Звезда', en: 'Star' } },
  { id: 'heart', name: { ru: 'Сердце', en: 'Heart' } },
  { id: 'crown', name: { ru: 'Корона', en: 'Crown' } },
  { id: 'diamond', name: { ru: 'Алмаз', en: 'Diamond' } },
  { id: 'hexagon', name: { ru: 'Гексагон', en: 'Hexagon' } },
  { id: 'cross', name: { ru: 'Крест', en: 'Cross' } },
  { id: 'australia', name: { ru: 'Австралия', en: 'Australia' } }
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
  if (kind === 'ukraine') return [
    [0.08, 0.29], [0.15, 0.22], [0.24, 0.24], [0.29, 0.18],
    [0.39, 0.16], [0.48, 0.20], [0.56, 0.18], [0.65, 0.22],
    [0.72, 0.24], [0.78, 0.30], [0.87, 0.32], [0.94, 0.39],
    [0.91, 0.45], [0.84, 0.49], [0.86, 0.55], [0.80, 0.60],
    [0.75, 0.62], [0.72, 0.70], [0.67, 0.75], [0.63, 0.84],
    [0.58, 0.79], [0.55, 0.71], [0.49, 0.67], [0.43, 0.63],
    [0.38, 0.59], [0.31, 0.57], [0.25, 0.52], [0.18, 0.50],
    [0.14, 0.44], [0.08, 0.43], [0.05, 0.36]
  ];
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
  if (kind === 'australia') return [[0.15,0.35],[0.24,0.23],[0.38,0.18],[0.48,0.25],[0.58,0.22],[0.7,0.3],[0.84,0.38],[0.8,0.49],[0.72,0.56],[0.65,0.7],[0.53,0.77],[0.43,0.68],[0.31,0.72],[0.22,0.61],[0.16,0.49]];
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
  return dx * dx / 0.225 + dy * dy / 0.225 <= 1;
}

export function createMapMask(width, height, mapId = 'ukraine') {
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
