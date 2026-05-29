import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { List, Tag } from 'antd';

export default function DashboardPage() {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const frontendResources = currentUser?.frontendResources || [];
  const backendResources = currentUser?.backendResources || [];
  const currentTenant = initialState?.availableTenants?.find(
    (tenant) => tenant.id === initialState.currentTenantId,
  );
  const tenantName =
    currentTenant?.name || currentTenant?.code || initialState?.currentTenantId || '-';

  return (
    <PageContainer title="工作台">
      <StatisticCard.Group>
        <StatisticCard
          statistic={{
            title: '当前租户',
            value: tenantName,
          }}
        />
        <StatisticCard
          statistic={{
            title: '前端资源',
            value: frontendResources.length,
          }}
        />
        <StatisticCard
          statistic={{
            title: '后端权限',
            value: currentUser?.permissions?.length || 0,
          }}
        />
      </StatisticCard.Group>
      <ProCard gutter={16} style={{ marginTop: 16 }}>
        <ProCard title="前端菜单资源" colSpan="50%">
          <List
            dataSource={frontendResources}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta title={item.name} description={item.path} />
                <Tag color="blue">{item.code}</Tag>
              </List.Item>
            )}
          />
        </ProCard>
        <ProCard title="后端接口权限" colSpan="50%">
          <List
            dataSource={backendResources}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta title={item.name} description={item.path} />
                <Tag color="orange">{item.code}</Tag>
              </List.Item>
            )}
          />
        </ProCard>
      </ProCard>
    </PageContainer>
  );
}
