import { setSelectedTenantId } from '@/utils/auth';
import { useModel } from '@umijs/max';
import { Select } from 'antd';

export default function TenantSwitcher() {
  const { initialState, refresh } = useModel('@@initialState');
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
        // 请求头 X-Tenant-Id 跟着选择走，按新租户重读菜单、权限与数据范围。
        setSelectedTenantId(tenantId);
        void refresh();
      }}
      popupMatchSelectWidth={220}
      showSearch
      style={{ minWidth: 160 }}
      value={currentTenantId}
    />
  );
}
