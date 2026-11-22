import { EmptyState } from '@admin-web/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Access } from './access.ts';
import { useAccess, useSession } from './SessionProvider.tsx';

export type RequireAccessProps = { flag: keyof Access; children: ReactNode };

/** 路由守卫：有权限才渲染页面，没有就显示 403；会话还在读取时什么都不渲染。 */
export function RequireAccess({ flag, children }: RequireAccessProps) {
  const { loading } = useSession();
  const access = useAccess();
  const { t } = useTranslation('common');
  if (loading) return null;
  if (!access[flag]) return <EmptyState title={t('status.forbidden')} />;
  return children;
}
