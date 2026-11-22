import { defineConfig } from 'vitest/config';
import { TEST_TIMEOUT } from './src/index.ts';

export default defineConfig({
  test: { environment: 'jsdom', testTimeout: TEST_TIMEOUT },
});
