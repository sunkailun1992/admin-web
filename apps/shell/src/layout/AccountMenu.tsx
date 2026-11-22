import {
  logout,
  logoutAndLeave,
  useSession,
  type SessionState,
} from '@admin-web/auth';
import {
  Button,
  DescriptionList,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@admin-web/ui';
import { CircleUser, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShell } from '../shell.ts';

/** 页头显示名（照 1.2.4）：会话里的名称，其次昵称、用户名。 */
export function accountName(state: SessionState, fallback: string): string {
  const user = state.currentUser;
  return (
    state.name || user?.nickname || user?.username || user?.name || fallback
  );
}

/** 账户菜单：账户设置与退出登录（退出时先清掉选中的租户，再经网关注销）。 */
export function AccountMenu() {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const session = useSession();
  const { client, navigation } = useShell();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const user = session.currentUser;
  if (!user) return null;
  const name = accountName(session, tc('account.defaultName'));
  const tenant = session.availableTenants?.find(
    (item) => item.id === session.currentTenantId,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t('account.menu')}>
            <CircleUser aria-hidden />
            <span className="max-w-32 truncate">{name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings aria-hidden />
            {t('account.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              void logoutAndLeave(() => logout(client), navigation)
            }
          >
            <LogOut aria-hidden />
            {tc('actions.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('account.settings')}</DialogTitle>
          </DialogHeader>
          <DescriptionList
            items={[
              { label: t('account.username'), value: user.username || '-' },
              { label: t('account.nickname'), value: name },
              {
                label: t('account.adminType'),
                value: user.adminType
                  ? t(`account.adminTypes.${user.adminType}`)
                  : '-',
              },
              {
                label: t('account.currentTenant'),
                value:
                  tenant?.name ||
                  tenant?.code ||
                  session.currentTenantId ||
                  '-',
              },
              {
                label: t('account.availableTenants'),
                value: String(session.availableTenants?.length ?? 0),
              },
            ]}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
