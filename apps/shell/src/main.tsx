import { createQueryClient } from '@admin-web/api';
import { initI18n } from '@admin-web/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { client } from './http.ts';
import { loadRemotes } from './remotes/loadRemotes.ts';
import { loadRegistry } from './remotes/registry.ts';
import './styles.css';

await initI18n();
// 注册表读不到时只有主应用自己的页面可用；单个子应用失败只影响它自己的域。
const apps = await loadRegistry().catch((error: unknown) => {
  console.error('[shell] failed to read apps.json', error);
  return [];
});
const remotes = await loadRemotes(apps);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={client} queryClient={createQueryClient()} remotes={remotes} />
  </StrictMode>,
);
