import '@admin-web/config-vitest/setup';
import { addTexts, initI18n } from '@admin-web/i18n';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { texts } from '../src/texts.ts';

await initI18n({ lng: 'zh-CN' });
addTexts(texts);

// jsdom 没有实现 matchMedia（sonner 的 Toaster 用它判断系统主题），照 Jest 文档“jsdom 未实现的方法”的做法补一个。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
