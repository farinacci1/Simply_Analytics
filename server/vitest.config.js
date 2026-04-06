import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['../tests/server/**/*.{test,spec}.js'],
    testTimeout: 10000,
  },
});
