import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [, , inputPath, outputPath = 'src/engine/maps/custom-mask.json', thresholdArg = '128'] = process.argv;
if (!inputPath) {
  console.error('Usage: node scripts/mask-from-png.js input.png [output.json] [threshold 0-255]');
  process.exit(1);
}

const threshold = Math.max(0, Math.min(255, Number(thresholdArg) || 128));
const png = PNG.sync.read(fs.readFileSync(inputPath));
const walkable = new Array(png.width * png.height);
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const offset = (y * png.width + x) * 4;
    const luminance = 0.2126 * png.data[offset] + 0.7152 * png.data[offset + 1] + 0.0722 * png.data[offset + 2];
    walkable[y * png.width + x] = png.data[offset + 3] > 0 && luminance >= threshold ? 1 : 0;
  }
}

const result = { width: png.width, height: png.height, walkable };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(`Saved ${png.width}x${png.height} mask (${walkable.reduce((sum, value) => sum + value, 0)} walkable pixels) to ${outputPath}`);
