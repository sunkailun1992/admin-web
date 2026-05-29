import { setSelectedTenantId } from '@/utils/auth';
import { history, useModel } from '@umijs/max';
import { Select } from 'antd';

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
        if (history.location.pathname !== '/system/tenant') {
          history.push('/system/tenant');
        }
      }}
      popupMatchSelectWidth={220}
      showSearch
      style={{ minWidth: 160 }}
      value={currentTenantId}
    />
  );
}
