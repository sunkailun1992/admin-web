import { useSession } from '@admin-web/auth';
import { SidebarInset, SidebarProvider } from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { SessionRecovery } from '../pages/SessionRecovery.tsx';
import { AppHeader } from './AppHeader.tsx';
import { AppSidebar } from './AppSidebar.tsx';

export function AppLayout() {
  // 换租户后内容区按新租户整个重挂（React 文档“用 key 重置状态”的做法）：页面在新会话就位后重新请求，
  // 打开的面板、选中的行等本地状态一并清掉，不留上一个租户的数据。
  const { currentTenantId } = useSession();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1">
          <Outlet key={currentTenantId ?? ''} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * 受保护的部分：首次读取会话时显示“加载中”；读不到资源进恢复页；没有网关会话时什么都不显示
 * （SessionProvider 已整页跳登录）。刷新会话（切换租户、重试）时保持原界面。
 */
export function SessionGate() {
  const { t } = useTranslation('common');
  const { loading, currentUser, sessionRecovery } = useSession();
  if (sessionRecovery) return <SessionRecovery />;
  if (currentUser) return <AppLayout />;
  if (loading) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        {t('status.loading')}
      </p>
    );
  }
  return null;
}
