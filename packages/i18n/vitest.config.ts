import { TEST_TIMEOUT } from '@admin-web/config-vitest';
import { defineConfig } from 'vitest/config';

// 语言偏好存在 localStorage、语言写在 <html lang>，测试用 jsdom 提供这两样。
export default defineConfig({
  test: { environment: 'jsdom', testTimeout: TEST_TIMEOUT },
});
