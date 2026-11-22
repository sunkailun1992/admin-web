import '@admin-web/config-vitest/setup';
import { initI18n } from '@admin-web/i18n';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../src/styles/globals.css';

await initI18n({ lng: 'zh-CN' });
afterEach(() => cleanup());
