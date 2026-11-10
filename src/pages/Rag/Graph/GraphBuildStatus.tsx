import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Space,
  Tag,
  Typography,
} from 'antd';
import { graphBuildMeta } from './graphModel';
import styles from './index.less';

type Props = {
  build?: RagAPI.GraphBuild;
  watching: boolean;
  error: boolean;
  pendingSubmission: boolean;
  canReadBuild: boolean;
  onLookup: () => void;
  onReadBuild: () => void;
};

export default function GraphBuildStatus({
  build,
  watching,
  error,
  pendingSubmission,
  canReadBuild,
  onLookup,
  onReadBuild,
}: Props) {
  if (!build && !watching && !error) return null;
  const status = build ? graphBuildMeta[build.status] : undefined;
  return (
    <section aria-label="图谱构建状态" className={styles.buildStatus}>
      <Space size={[8, 4]} wrap>
        <Typography.Text strong>构建状态</Typography.Text>
        <Tag color={status?.color || 'default'}>
          {status?.name || (watching ? '正在读取状态' : '状态读取失败')}
        </Tag>
        {build && (
          <Typography.Text type="secondary">
            已处理文档 {build.processedDocumentCount} / {build.documentCount}
          </Typography.Text>
        )}
        {build &&
          (build.status === 'FAILED' || build.status === 'CANCELLED') && (
            <Typography.Text type="warning">
              本次未构建成功，继续显示已发布图谱
            </Typography.Text>
          )}
      </Space>
      {build && (
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'details',
              label: '查看构建详情',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                    <Descriptions.Item label="实体出现次数">
                      {build.nodeCount}
                    </Descriptions.Item>
                    <Descriptions.Item label="关系出现次数">
                      {build.edgeCount}
                    </Descriptions.Item>
                    {build.updatedAt && (
                      <Descriptions.Item label="更新时间">
                        {build.updatedAt}
                      </Descriptions.Item>
                    )}
                    {build.errorCode && (
                      <Descriptions.Item label="错误代码">
                        {build.errorCode}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                  <Typography.Text type="secondary">
                    构建计数按来源累计，当前画布按实体与关系聚合，数量可能不同。
                  </Typography.Text>
                </Space>
              ),
            },
          ]}
        />
      )}
      {error && (
        <Alert
          showIcon
          type="error"
          message="图谱提交或状态读取失败，已发布结果保持不变"
          description={
            pendingSubmission
              ? '提交结果尚未确认。请查回同一提交；查无记录后如需重发，明确确认重新构建，仍复用原提交键。'
              : undefined
          }
          action={
            pendingSubmission ? (
              <Button size="small" onClick={onLookup}>
                查回提交结果
              </Button>
            ) : canReadBuild ? (
              <Button size="small" onClick={onReadBuild}>
                重试读取状态
              </Button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
