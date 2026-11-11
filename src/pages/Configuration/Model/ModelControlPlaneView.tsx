import { ExportOutlined } from '@ant-design/icons';
import {
  Alert,
  Card,
  Descriptions,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  capabilityLabels,
  catalogRowKey,
  consoleLinks,
  filterCatalog,
} from './controlPlaneModel';
import styles from './index.less';

const verification: Record<
  AiAPI.ModelVerification,
  { text: string; color?: string }
> = {
  NOT_CHECKED: { text: '未验证' },
  VERIFIED: { text: '上次实测通过', color: 'success' },
  FAILED: { text: '最近验证失败', color: 'error' },
  UNKNOWN: { text: '验证状态未知', color: 'warning' },
};
const date = (value: string | null) =>
  value ? value.replace('T', ' ').replace('Z', ' UTC') : '未提供';

export default function ModelControlPlaneView({
  data,
  query = '',
  selectedCapability,
  onQuery,
  onCapability,
}: {
  data: AiAPI.ModelControlPlaneVO;
  query?: string;
  selectedCapability?: AiAPI.ModelCapability;
  onQuery?: (value: string) => void;
  onCapability?: (value?: AiAPI.ModelCapability) => void;
}) {
  const links = consoleLinks(data.consoleBaseUrl);
  const rows = filterCatalog(data.modelCatalog, query, selectedCapability);
  return (
    <div className={styles.workbench}>
      <Alert
        showIcon
        type={data.available ? 'info' : 'warning'}
        message={
          data.available
            ? '模型管理目录已读回'
            : data.status === 'NOT_CONFIGURED'
            ? '尚未配置模型控制台连接'
            : '暂时无法读取模型管理目录'
        }
        description="目录可读不代表模型健康。模型部署、供应商凭据、虚拟密钥与额度统一在 LiteLLM 原生控制台管理；本页不自动调用模型。"
      />
      <Card title="LiteLLM 原生管理" size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="运行版本">
            {data.platformVersion || '上游未提供可靠版本'}
          </Descriptions.Item>
          <Descriptions.Item label="配置源">LiteLLM 数据库</Descriptions.Item>
          <Descriptions.Item label="目录读取时间">
            {date(data.checkedAt)}
          </Descriptions.Item>
        </Descriptions>
        {links.length ? (
          <nav
            aria-label="LiteLLM 原生控制台入口"
            className={styles.consoleLinks}
          >
            {links.map((item) => (
              <a
                className={styles.consoleLink}
                key={item.path}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={styles.linkTitle}>
                  {item.title}
                  <ExportOutlined />
                </span>
                <span>{item.description}</span>
              </a>
            ))}
          </nav>
        ) : (
          <Typography.Paragraph type="secondary">
            服务未返回可用的控制台入口，请联系平台管理员配置。
          </Typography.Paragraph>
        )}
        <Typography.Paragraph type="secondary" className={styles.hint}>
          新窗口使用控制台自己的登录和权限。连接验证可能调用供应商并产生用量；可用功能以本环境原生控制台权限和版本为准。
        </Typography.Paragraph>
      </Card>
      <Card
        title="本环境模型目录"
        size="small"
        extra={
          <Typography.Text type="secondary">
            {data.available
              ? `${
                  new Set(data.modelCatalog.map((row) => row.id)).size
                } 个部署 / ${data.modelCatalog.length} 条目录记录`
              : '部署数量尚未确认'}
          </Typography.Text>
        }
      >
        <Space wrap className={styles.filters}>
          <Input
            allowClear
            aria-label="搜索模型目录"
            placeholder="搜索名称、供应商或物理模型"
            value={query}
            onChange={(event) => onQuery?.(event.target.value)}
            className={styles.search}
          />
          <Select
            allowClear
            aria-label="筛选模型能力"
            placeholder="全部能力"
            value={selectedCapability}
            onChange={onCapability}
            className={styles.capability}
            options={Object.entries(capabilityLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Space>
        <Table<AiAPI.ModelCatalogItem>
          rowKey={catalogRowKey}
          size="small"
          dataSource={rows}
          scroll={{ x: 880 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  !data.available
                    ? '目录尚不可读，不能判断是否存在模型'
                    : data.modelCatalog.length
                    ? '没有符合筛选条件的部署'
                    : '本环境尚无已配置模型部署'
                }
              />
            ),
          }}
          columns={[
            {
              title: '调用名称',
              dataIndex: 'modelName',
              width: 180,
              render: (value) => (
                <span className={styles.longValue}>{value}</span>
              ),
            },
            {
              title: '供应商 / 物理模型',
              key: 'physical',
              width: 230,
              render: (_, row) => (
                <div className={styles.longValue}>
                  {row.provider || '供应商未确认'}
                  <br />
                  <Typography.Text type="secondary">
                    {row.model || '物理模型未返回'}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: '能力声明',
              key: 'capabilities',
              width: 160,
              render: (_, row) => (
                <Space wrap size={[0, 4]}>
                  {row.capabilities.map((item) => (
                    <Tag key={item}>{capabilityLabels[item]}</Tag>
                  ))}
                </Space>
              ),
            },
            {
              title: '上下文窗口',
              dataIndex: 'contextWindow',
              width: 110,
              render: (value) =>
                value ? `${value.toLocaleString()} tokens` : '未提供',
            },
            {
              title: '最近实测',
              key: 'verification',
              width: 200,
              render: (_, row) => (
                <>
                  <Tag color={verification[row.verificationStatus].color}>
                    {verification[row.verificationStatus].text}
                  </Tag>
                  {row.verifiedAt ? <div>{date(row.verifiedAt)}</div> : null}
                </>
              ),
            },
          ]}
        />
        <Typography.Paragraph type="secondary" className={styles.hint}>
          能力标签是已配置部署的声明，不代表当前业务已经接入
          OCR、语音、图片或视频。未返回的能力保持未确认，不从框架全量模型价格表补造在线目录。
        </Typography.Paragraph>
      </Card>
      <Card title="业务任务绑定" size="small">
        <Typography.Paragraph type="secondary">
          仅显示服务返回的真实业务绑定。RAG
          索引使用的物理模型与维度不可在此热切换，变更须由业务评估索引重建；没有返回参数时不猜测当前值。
        </Typography.Paragraph>
        <Table<AiAPI.ModelTaskBinding>
          rowKey="taskCode"
          size="small"
          pagination={false}
          dataSource={data.taskBindings}
          scroll={{ x: 640 }}
          locale={{
            emptyText: '服务尚未返回业务任务绑定；下方仍可读取现有默认路由。',
          }}
          columns={[
            { title: '任务', dataIndex: 'taskName', width: 180 },
            {
              title: '类型',
              dataIndex: 'capability',
              width: 120,
              render: (value: AiAPI.ModelCapability) => capabilityLabels[value],
            },
            {
              title: '当前模型',
              dataIndex: 'modelName',
              render: (value) => (
                <span className={styles.longValue}>{value || '未配置'}</span>
              ),
            },
            {
              title: '使用状态',
              key: 'status',
              width: 240,
              render: (_, row) => (
                <>
                  {row.status === 'CONFIGURED'
                    ? '已有配置'
                    : row.status === 'NOT_CONFIGURED'
                    ? '未配置'
                    : '业务未接入'}
                  {row.reasonCode === 'RAG_INDEX_BOUND' ? (
                    <div>
                      <Typography.Text type="secondary">
                        索引绑定参数只读，变更需先评估重建。
                      </Typography.Text>
                    </div>
                  ) : row.readOnly ? (
                    <div>
                      <Typography.Text type="secondary">
                        由业务执行层管理
                      </Typography.Text>
                    </div>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
