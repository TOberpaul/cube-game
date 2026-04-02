import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['dice-game-pwa/tests/**/*.test.js'],
  },
});
