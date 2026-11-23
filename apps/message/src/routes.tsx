import { RequireAccess, type RemoteRoutes } from '@admin-web/auth';
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';
import { canSeeMessageSend } from './access.ts';
import './styles.css';
import { texts } from './texts.ts';

const SendPage = lazy(() => import('./pages/Send/index.tsx'));

/** 消息子应用的接入契约：消息发送页与菜单元数据（铃铛另经 ./Bell 暴露）。 */
const routes: RemoteRoutes = {
  texts,
  routes: [
    { path: '/message', element: <Navigate to="/message/send" replace /> },
    {
      path: '/message/send',
      element: (
        <RequireAccess rule={canSeeMessageSend}>
          <Suspense fallback={null}>
            <SendPage />
          </Suspense>
        </RequireAccess>
      ),
    },
  ],
  menu: [
    {
      path: '/message/send',
      labelKey: 'message:menu.send',
      access: canSeeMessageSend,
      group: { key: 'message', labelKey: 'message:menu.group' },
    },
  ],
};

export default routes;
