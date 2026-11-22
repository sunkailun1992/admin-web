import { useSession } from '@admin-web/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ItemList,
  ListRow,
  PageContainer,
} from '@admin-web/ui';
import { useTranslation } from 'react-i18next';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground">{label}</p>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** 工作台（照 1.2.4）：当前租户与资源数，前端菜单资源和后端接口权限两个列表。 */
export function Dashboard() {
  const { t } = useTranslation('shell');
  const { currentUser, availableTenants, currentTenantId } = useSession();
  const tenant = availableTenants?.find((item) => item.id === currentTenantId);
  const tenantName = tenant?.name || tenant?.code || currentTenantId || '-';
  const frontend = currentUser?.frontendResources ?? [];
  const backend = currentUser?.backendResources ?? [];
  return (
    <PageContainer title={t('dashboard.title')}>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={t('dashboard.currentTenant')} value={tenantName} />
        <Stat
          label={t('dashboard.frontendResources')}
          value={frontend.length}
        />
        <Stat
          label={t('dashboard.backendPermissions')}
          value={currentUser?.permissions?.length ?? 0}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t('dashboard.frontendMenus')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList
              items={frontend}
              rowKey={(item) => item.id}
              renderItem={(item) => (
                <ListRow
                  title={item.name}
                  description={item.path}
                  extra={<Badge variant="secondary">{item.code}</Badge>}
                />
              )}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t('dashboard.backendApis')}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList
              items={backend}
              rowKey={(item) => item.id}
              renderItem={(item) => (
                <ListRow
                  title={item.name}
                  description={item.path}
                  extra={<Badge variant="outline">{item.code}</Badge>}
                />
              )}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
