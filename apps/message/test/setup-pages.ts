import '@admin-web/config-vitest/setup';
import { addTexts, initI18n } from '@admin-web/i18n';
import '@admin-web/test-utils/no-motion';
import '@admin-web/ui/globals.css';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../src/styles.css';
import { texts } from '../src/texts.ts';

await initI18n({ lng: 'zh-CN' });
addTexts(texts);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
