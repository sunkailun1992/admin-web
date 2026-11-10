import { Card, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import styles from './index.less';
import { providerLabel } from './modelSelectionModel';

export default function ModelRouteOverview({
  selection,
  stale = false,
}: {
  selection: AiAPI.ModelSelectionVO;
  stale?: boolean;
}) {
  const providers = selection.supportedProviders || [];
  return (
    <>
      <Card className={styles.currentRoute}>
        <div className={styles.routeHeading}>
          <Typography.Text type="secondary">
            {stale ? '上次读取路由' : '当前默认路由'}
          </Typography.Text>
          <Tag color="blue">全局配置</Tag>
        </div>
        <Typography.Title level={3} className={styles.providerName}>
          {providerLabel(selection.provider)}
        </Typography.Title>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="生效模型">
            {selection.model ? (
              <Typography.Text code className={styles.modelName}>
                {selection.model}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                服务未返回模型名称
              </Typography.Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="配置更新时间">
            {selection.updatedAt?.replace('T', ' ') || '服务未返回更新时间'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <section aria-label="服务支持的供应商">
        <div className={styles.sectionHeading}>
          <Typography.Title level={5}>服务支持的供应商</Typography.Title>
          <Typography.Text type="secondary">
            支持项由当前服务声明
          </Typography.Text>
        </div>
        {providers.length ? (
          <div className={styles.providerGrid}>
            {providers.map((provider) => (
              <Card key={provider} size="small" className={styles.providerCard}>
                <Space direction="vertical" size={8}>
                  <Typography.Text strong>
                    {providerLabel(provider)}
                  </Typography.Text>
                  <Space size={4} wrap>
                    <Tag>服务支持</Tag>
                    {provider === selection.provider ? (
                      <Tag color="blue">当前默认</Tag>
                    ) : null}
                  </Space>
                </Space>
              </Card>
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="服务未返回支持项"
          />
        )}
        {providers.length ? (
          <Typography.Paragraph type="secondary" className={styles.supportNote}>
            支持项不表示已配置凭据或通过连接测试。
          </Typography.Paragraph>
        ) : null}
      </section>
    </>
  );
}
