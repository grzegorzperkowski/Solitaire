import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
    },
  },
});
