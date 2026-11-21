import { DEFAULT_TENANT_ID } from '@/constants/auth';
import { useModel } from '@umijs/max';
import { useMemo } from 'react';

// 没有可用租户时用同一个空数组，下面 useMemo 的依赖才不会每次渲染都变。
const NO_TENANTS: API.AuthTenantVO[] = [];

export function useTenantOptions() {
  const { initialState } = useModel('@@initialState');
  const tenants = initialState?.availableTenants ?? NO_TENANTS;
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
