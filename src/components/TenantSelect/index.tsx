import { listTenants } from '@/services/auth';
import { ProFormSelect } from '@ant-design/pro-components';

interface TenantSelectProps {
  disabled?: boolean;
  name?: string;
  required?: boolean;
}

export default function TenantSelect({
  disabled,
  name = 'tenantId',
  required = true,
}: TenantSelectProps) {
  return (
    <ProFormSelect
      disabled={disabled}
      label="租户"
      name={name}
      request={async () => {
        const tenants = await listTenants({ assignment: true });
        return tenants.map((tenant) => ({
          label: `${tenant.name || tenant.id}（${tenant.code || tenant.id}）`,
          value: tenant.id,
        }));
      }}
      rules={
        required ? [{ required: true, message: '请选择租户' }] : undefined
      }
      showSearch
      width="md"
    />
  );
}
