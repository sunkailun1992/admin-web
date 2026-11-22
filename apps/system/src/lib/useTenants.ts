import { useSession } from '@admin-web/auth';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** 平台的默认租户编号（1.2.4 的 DEFAULT_TENANT_ID）。 */
const DEFAULT_TENANT_ID = '100';

/** 当前租户与可用租户（照 1.2.4 的 useTenantOptions）：展示时用租户名称，tenantId 只作接口字段。 */
export function useTenants() {
  const { t } = useTranslation('system');
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
        ? t('common.defaultTenant')
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
