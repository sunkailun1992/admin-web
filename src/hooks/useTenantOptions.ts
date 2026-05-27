import { DEFAULT_TENANT_ID } from '@/constants/auth';
import { listTenants } from '@/services/auth';
import { useEffect, useMemo, useState } from 'react';

export function useTenantOptions() {
  const [tenants, setTenants] = useState<API.AuthTenantVO[]>([]);

  useEffect(() => {
    listTenants({ assignment: true }).then(setTenants).catch(() => {
      setTenants([]);
    });
  }, []);

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
    getTenantName,
    tenantValueEnum,
    tenants,
  };
}
