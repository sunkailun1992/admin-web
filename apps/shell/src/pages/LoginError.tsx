import { redirectToLogin } from '@admin-web/auth';
import { Button } from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { useShell } from '../shell.ts';

/**
 * 登录失败页（/login?error）：网关登录回调失败时跳到这里。这一页不检查会话、也不自动跳登录，
 * 回调一直失败时不会在网关与 Keycloak 之间整页循环；由用户点“重新登录”再走一遍网关登录。
 */
export function LoginError() {
  const { t } = useTranslation('shell');
  const { navigation } = useShell();
  const failed = new URLSearchParams(useLocation().search).has('error');
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">
        {failed ? t('login.failedTitle') : t('login.title')}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {failed ? t('login.failedDescription') : t('login.description')}
      </p>
      <Button type="button" onClick={() => redirectToLogin(navigation)}>
        {t('login.retry')}
      </Button>
    </main>
  );
}
