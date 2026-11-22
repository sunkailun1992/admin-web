import '@admin-web/config-vitest/setup';
import { initI18n } from '@admin-web/i18n';
import '@admin-web/test-utils/no-motion';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../src/styles.css';

await initI18n({ lng: 'zh-CN' });

afterEach(async () => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
  await initI18n({ lng: 'zh-CN' });
});
