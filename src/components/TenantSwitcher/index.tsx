import { setSelectedTenantId } from '@/utils/auth';
import { useModel } from '@umijs/max';
import { Select } from 'antd';

export const TENANT_CHANGE_EVENT = 'admin-web-tenant-change';

export default function TenantSwitcher() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const tenants = initialState?.availableTenants || [];
  const currentTenantId = initialState?.currentTenantId;

  if (!initialState?.currentUser || tenants.length === 0) {
    return null;
  }

  return (
    <Select
      options={tenants.map((tenant) => ({
        label: tenant.name || tenant.code || tenant.id,
        value: tenant.id,
      }))}
      onChange={(tenantId) => {
        setSelectedTenantId(tenantId);
        setInitialState({
          ...initialState,
          currentTenantId: tenantId,
        });
        window.dispatchEvent(new Event(TENANT_CHANGE_EVENT));
      }}
      popupMatchSelectWidth={220}
      showSearch
      style={{ minWidth: 160 }}
      value={currentTenantId}
    />
  );
}
