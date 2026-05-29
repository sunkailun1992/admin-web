import HeaderAccount from '@/components/HeaderAccount';
import TenantSwitcher from '@/components/TenantSwitcher';
import { PageContainer as ProPageContainer } from '@ant-design/pro-components';
import { Space } from 'antd';
import type { ComponentProps, ReactNode } from 'react';

type AppPageContainerProps = ComponentProps<typeof ProPageContainer>;

function normalizeExtra(extra: AppPageContainerProps['extra']): ReactNode[] {
  if (!extra) {
    return [];
  }
  return Array.isArray(extra) ? extra : [extra];
}

export default function AppPageContainer(props: AppPageContainerProps) {
  const { extra, ...rest } = props;
  const extraItems = normalizeExtra(extra);

  return (
    <ProPageContainer
      {...rest}
      extra={
        <Space size={12}>
          {extraItems}
          <TenantSwitcher />
          <HeaderAccount />
        </Space>
      }
    />
  );
}
