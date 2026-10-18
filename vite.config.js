import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [react(), ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.html', open: false, gzipSize: true, brotliSize: true })] : [])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
