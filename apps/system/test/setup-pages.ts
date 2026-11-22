import '@admin-web/config-vitest/setup';
import { initI18n } from '@admin-web/i18n';
import '@admin-web/test-utils/no-motion';
import '@admin-web/ui/globals.css';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

await initI18n({ lng: 'zh-CN' });

afterEach(() => {
  cleanup();
  localStorage.clear();
});
