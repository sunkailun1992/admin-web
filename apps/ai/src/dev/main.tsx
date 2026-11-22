import { StandaloneShell } from '@admin-web/auth';
import { initI18n } from '@admin-web/i18n';
import '@admin-web/ui/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { client } from '../http.ts';
import routes from '../routes.tsx';

// 单独运行（只在开发时用）：最小外壳，登录统一到主应用的 8000 端口完成。
await initI18n();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StandaloneShell remote={routes} client={client} />
  </StrictMode>,
);
