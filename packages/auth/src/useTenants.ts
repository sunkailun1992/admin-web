import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from './SessionProvider.tsx';

/** 平台的默认租户编号（1.2.4 的 DEFAULT_TENANT_ID）。 */
export const DEFAULT_TENANT_ID = '100';

/**
 * 当前租户与可用租户（照 1.2.4 的 useTenantOptions）：展示时用租户名称，tenantId 只作接口字段；
 * 当前租户依次取选中的、用户所属的、平台默认的。
 */
export function useTenants() {
  const { t } = useTranslation('common');
  const session = useSession();
  const tenants = useMemo(
    () => session.availableTenants ?? [],
    [session.availableTenants],
  );
  const currentTenantId =
    session.currentTenantId ||
    session.currentUser?.tenantId ||
    DEFAULT_TENANT_ID;
  const tenantName = useCallback(
    (tenantId?: string) => {
      if (!tenantId) return '-';
      const tenant = tenants.find((item) => item.id === tenantId);
      if (tenant?.name) return tenant.name;
      return tenantId === DEFAULT_TENANT_ID
        ? t('tenant.defaultName')
        : tenantId;
    },
    [tenants, t],
  );
  const options = useMemo(
    () =>
      tenants.map((tenant) => ({
        value: tenant.id,
        label: tenant.name || tenant.code || tenant.id,
      })),
    [tenants],
  );
  return { currentTenantId, tenants, tenantName, options };
}
