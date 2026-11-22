import { TEST_TIMEOUT } from '@admin-web/config-vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', testTimeout: TEST_TIMEOUT },
});
