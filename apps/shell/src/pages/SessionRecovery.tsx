import { logout, logoutAndLeave, useSession } from '@admin-web/auth';
import { Button } from '@admin-web/ui';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useShell } from '../shell.ts';

/**
 * 会话暂未恢复（照 1.2.4 的 SessionRecovery）：读不到身份与权限资源时暂停显示受保护内容，
 * 只给“重试”与“退出登录”；重试成功回到工作台，进行中不重复请求。
 */
export function SessionRecovery() {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const { refresh } = useSession();
  const { client, navigation } = useShell();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'retry' | 'logout'>();

  const retry = async () => {
    setBusy('retry');
    try {
      await refresh();
      navigate('/dashboard', { replace: true });
    } finally {
      setBusy(undefined);
    }
  };

  const leave = () => {
    setBusy('logout');
    void logoutAndLeave(() => logout(client), navigation);
  };

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <CircleAlert aria-hidden className="size-10 text-amber-600" />
        <h1 className="text-xl font-semibold">{t('recovery.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('recovery.description')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={() => void retry()}
            disabled={busy !== undefined}
          >
            {tc('actions.retry')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={leave}
            disabled={busy !== undefined}
          >
            {tc('actions.logout')}
          </Button>
        </div>
      </div>
    </main>
  );
}
