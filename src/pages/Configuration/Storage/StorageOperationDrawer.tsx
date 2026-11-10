import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  List,
  Space,
  Tag,
  Typography,
} from 'antd';
import styles from './index.less';
import type { StorageState } from './storageModel';
import { storageFailureText } from './storageModel';
import StorageTimestamp from './StorageTimestamp';
const statusLabels: Record<string, string> = {
  NOT_STARTED: '未开始',
  PENDING: '待执行',
  RUNNING: '执行中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
  UNKNOWN: '结果未知',
  SKIPPED: '已跳过',
  NOT_NEEDED: '无需清理',
};
const stepLabels: Record<string, string> = {
  WRITE: '写入合成探测对象',
  EXISTS: '核对对象存在',
  READ: '读取并校验',
  VERIFY_PRIVATE: '验证私有访问',
  CLEANUP: '清理本次探测对象',
};
const actionLabels: Record<AiAPI.StorageAction, string> = {
  CREATE: '创建配置',
  UPDATE: '更新配置',
  DELETE: '删除配置元数据',
  UPDATE_SETTINGS: '更新全局策略',
  PROBE: '读写探测',
};
const color = (value: string) =>
  value === 'SUCCEEDED'
    ? 'success'
    : value === 'FAILED'
    ? 'error'
    : value === 'UNKNOWN'
    ? 'warning'
    : 'default';
export default function StorageOperationDrawer({
  open,
  state,
  onClose,
  onLookup,
}: {
  open: boolean;
  state: StorageState;
  onClose: () => void;
  onLookup: () => void;
}) {
  const operation = state.operation;
  return (
    <Drawer
      title="存储操作详情"
      open={open}
      onClose={onClose}
      width={560}
      extra={
        state.pending ? (
          <Button
            loading={state.phase === 'checking' || state.phase === 'submitting'}
            onClick={onLookup}
            disabled={state.phase === 'submitting' || state.phase === 'blocked'}
          >
            只读查回
          </Button>
        ) : undefined
      }
    >
      {state.pending ? (
        <Alert
          className={styles.section}
          type="warning"
          showIcon
          message="原操作尚未确认终态"
          description="继续使用同一请求标识只读查询；不会自动重发创建、更新、删除或探测。刷新页面也先恢复查回。"
        />
      ) : null}
      {state.error ? (
        <Alert
          className={styles.section}
          type="error"
          showIcon
          message={state.error}
        />
      ) : null}
      <Descriptions column={1} size="small">
        <Descriptions.Item label="操作类型">
          {operation
            ? actionLabels[operation.action]
            : state.pending
            ? actionLabels[state.pending.action]
            : '尚无操作'}
        </Descriptions.Item>
        <Descriptions.Item label="请求标识">
          <Typography.Text className={styles.longValue} code>
            {state.pending?.requestId || operation?.requestId || '尚无操作'}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="操作状态">
          {operation ? (
            <Tag color={color(operation.status)}>
              {statusLabels[operation.status]}
            </Tag>
          ) : state.pending ? (
            '等待查回'
          ) : (
            '尚无操作'
          )}
        </Descriptions.Item>
        {operation ? (
          <>
            <Descriptions.Item label="检查配置版本">
              {operation.checkedRevision ?? '不适用'}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              <StorageTimestamp value={operation.startedAt} />
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              <StorageTimestamp value={operation.finishedAt} />
            </Descriptions.Item>
            <Descriptions.Item label="探测对象清理">
              <Tag color={color(operation.cleanupStatus)}>
                {statusLabels[operation.cleanupStatus]}
              </Tag>
            </Descriptions.Item>
          </>
        ) : null}
      </Descriptions>
      {operation?.failureCode ? (
        <Alert
          className={styles.section}
          type="error"
          showIcon
          message={storageFailureText(operation.failureCode)}
        />
      ) : null}
      {operation?.cleanupStatus === 'FAILED' ||
      operation?.cleanupStatus === 'UNKNOWN' ? (
        <Alert
          className={styles.section}
          type="warning"
          showIcon
          message="探测清理需要继续核对"
          description="不要以写入或读取步骤完成代替清理成功。请保留本次请求标识联系平台管理员。"
        />
      ) : null}
      {operation?.steps.length ? (
        <List
          className={styles.section}
          header="实际探测步骤"
          dataSource={operation.steps}
          renderItem={(step) => (
            <List.Item>
              <Space direction="vertical">
                <Space>
                  <Typography.Text>{stepLabels[step.name]}</Typography.Text>
                  <Tag color={color(step.status)}>
                    {statusLabels[step.status]}
                  </Tag>
                </Space>
                {step.failureCode ? (
                  <Typography.Text type="danger">
                    {storageFailureText(step.failureCode)}
                  </Typography.Text>
                ) : null}
              </Space>
            </List.Item>
          )}
        />
      ) : null}
      {operation?.action !== 'PROBE' ? (
        <Typography.Paragraph className={styles.section} type="secondary">
          配置操作终态不表示供应商连接正常。需要时请从配置列表明确发起一次读写探测。
        </Typography.Paragraph>
      ) : null}
    </Drawer>
  );
}
