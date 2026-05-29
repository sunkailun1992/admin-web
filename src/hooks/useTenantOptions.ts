import { DEFAULT_TENANT_ID } from '@/constants/auth';
import { useModel } from '@umijs/max';
import { useMemo } from 'react';

export function useTenantOptions() {
  const { initialState } = useModel('@@initialState');
  const tenants = initialState?.availableTenants || [];
  const currentTenantId =
    initialState?.currentTenantId ||
    initialState?.currentUser?.tenantId ||
    DEFAULT_TENANT_ID;

  const tenantValueEnum = useMemo(() => {
    return tenants.reduce<Record<string, { text: string }>>((memo, tenant) => {
      memo[tenant.id] = { text: tenant.name || tenant.code || tenant.id };
      return memo;
    }, {});
  }, [tenants]);

  const getTenantName = (tenantId?: string) => {
    if (!tenantId) {
      return '-';
    }
    const tenant = tenants.find((item) => item.id === tenantId);
    if (tenant?.name) {
      return tenant.name;
    }
    return tenantId === DEFAULT_TENANT_ID ? '默认租户' : tenantId;
  };

  return {
    currentTenantId,
    getTenantName,
    tenantValueEnum,
    tenants,
  };
}
