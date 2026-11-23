import { EmptyState } from '@admin-web/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccessRule } from './access.ts';
import { useAllows, useSession } from './SessionProvider.tsx';

export type RequireAccessProps = { rule: AccessRule; children: ReactNode };

/** 路由守卫：满足子应用声明的权限规则才渲染页面，否则显示 403；会话还在读取时什么都不渲染。 */
export function RequireAccess({ rule, children }: RequireAccessProps) {
  const { loading } = useSession();
  const allowed = useAllows(rule);
  const { t } = useTranslation('common');
  if (loading) return null;
  if (!allowed) return <EmptyState title={t('status.forbidden')} />;
  return children;
}
