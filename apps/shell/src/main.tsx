import { createQueryClient } from '@admin-web/api';
import { initI18n } from '@admin-web/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { client } from './http.ts';
import { createRemoteStore, federationRuntime } from './remotes/loadRemotes.ts';
import { loadRegistry } from './remotes/registry.ts';
import './styles.css';

await initI18n();
// 主应用先渲染：子应用清单与各子应用在后台各自加载，慢的、坏的只影响它自己的域。
const remotes = createRemoteStore({
  readRegistry: () => loadRegistry(),
  runtime: federationRuntime(),
});
void remotes.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App client={client} queryClient={createQueryClient()} remotes={remotes} />
  </StrictMode>,
);
