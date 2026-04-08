import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/cube-game/' : '/',
  resolve: {
    alias: {
      '@pwa': path.resolve(__dirname, '../dice-game-pwa/js'),
      '@design': path.resolve(__dirname, '../design-system'),
      'three/addons/loaders/GLTFLoader.js': path.resolve(__dirname, 'node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
      'three': path.resolve(__dirname, 'node_modules/three'),
      'motion': path.resolve(__dirname, 'node_modules/motion'),
    },
  },
  server: {
    fs: {
      allow: [
        // Allow serving files from the parent directory (for design-system, dice-game-pwa)
        path.resolve(__dirname, '..'),
      ],
    },
  },
  // Make the GLB model and locale files accessible
  publicDir: 'public',
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
