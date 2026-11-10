import { Button, Table, Tag, Typography } from 'antd';
import styles from './index.less';
import { probeState, runtimeState } from './storageModel';
export type StorageRowIntent = {
  action: 'DELETE' | 'PROBE' | 'TOGGLE' | 'DEFAULT';
  row: AiAPI.StorageConfigurationVO;
};
export default function StorageConfigurationTable({
  list,
  capabilities,
  writable,
  loading,
  onPage,
  onEdit,
  onIntent,
}: {
  list: AiAPI.StorageList;
  capabilities: AiAPI.StorageCapabilitiesVO;
  writable: boolean;
  loading: boolean;
  onPage: (page: number, size: number) => void;
  onEdit: (row: AiAPI.StorageConfigurationVO) => void;
  onIntent: (intent: StorageRowIntent) => void;
}) {
  return (
    <Table<AiAPI.StorageConfigurationVO>
      rowKey="id"
      size="small"
      dataSource={list.items}
      loading={loading}
      scroll={{ x: 1180 }}
      pagination={{
        current: list.page,
        pageSize: list.size,
        total: list.total,
        showSizeChanger: true,
        pageSizeOptions: [20, 50, 100],
        onChange: onPage,
        disabled: !writable,
      }}
      locale={{
        emptyText:
          '尚无符合条件的存储配置；新增并显式设为默认后才能用于新上传。',
      }}
      columns={[
        {
          title: '配置 / 平台',
          key: 'identity',
          width: 200,
          render: (_, row) => (
            <div className={styles.longValue}>
              <Typography.Text strong>{row.name}</Typography.Text>
              {row.isDefault ? <Tag color="blue">当前默认</Tag> : null}
              <div className={styles.metadata}>{row.platform}</div>
              <Tag>
                {capabilities.providers.find(
                  (entry) => entry.code === row.provider,
                )?.label || row.provider}
              </Tag>
            </div>
          ),
        },
        {
          title: '对象位置',
          key: 'location',
          width: 240,
          render: (_, row) => (
            <div className={styles.longValue}>
              {row.bucket}
              <div className={styles.metadata}>{row.endpoint}</div>
              {row.region ? (
                <div className={styles.metadata}>{row.region}</div>
              ) : null}
            </div>
          ),
        },
        {
          title: '状态',
          key: 'state',
          width: 180,
          render: (_, row) => {
            const runtime = runtimeState(row);
            return (
              <>
                <Tag color={row.uploadEnabled ? 'blue' : 'default'}>
                  {row.uploadEnabled ? '允许新上传' : '已停用新上传'}
                </Tag>
                <Tag color={runtime.color}>{runtime.text}</Tag>
                <div className={styles.metadata}>
                  保存 r{row.configRevision} / 生效{' '}
                  {row.appliedRevision === null
                    ? '未确认'
                    : `r${row.appliedRevision}`}
                </div>
              </>
            );
          },
        },
        {
          title: '凭据 / 引用',
          key: 'credentials',
          width: 130,
          render: (_, row) => (
            <>
              {row.credentialsConfigured ? '凭据已配置' : '凭据未配置'}
              <div className={styles.metadata}>
                {row.referenceCount} 个文件引用
              </div>
            </>
          ),
        },
        {
          title: '读写探测',
          key: 'probe',
          width: 190,
          render: (_, row) => {
            const probe = probeState(row);
            return (
              <>
                <Tag color={probe.color}>{probe.text}</Tag>
                {row.lastProbe ? (
                  <>
                    <div className={styles.metadata}>
                      检查 r{row.lastProbe.checkedRevision}
                    </div>
                    <div className={styles.metadata}>
                      {row.lastProbe.finishedAt || '尚无完成时间'}
                    </div>
                  </>
                ) : null}
              </>
            );
          },
        },
        {
          title: '操作',
          key: 'actions',
          fixed: 'right',
          width: 240,
          render: (_, row) => (
            <div className={styles.tableActions}>
              <Button
                size="small"
                type="link"
                disabled={!writable}
                onClick={() => onEdit(row)}
              >
                编辑
              </Button>
              <Button
                size="small"
                type="link"
                disabled={
                  !writable ||
                  !row.credentialsConfigured ||
                  runtimeState(row).state !== 'APPLIED'
                }
                onClick={() => onIntent({ action: 'PROBE', row })}
              >
                读写探测
              </Button>
              <Button
                size="small"
                type="link"
                disabled={!writable}
                onClick={() => onIntent({ action: 'TOGGLE', row })}
              >
                {row.uploadEnabled ? '停用新上传' : '启用新上传'}
              </Button>
              <Button
                size="small"
                type="link"
                disabled={
                  !writable ||
                  row.isDefault ||
                  !row.uploadEnabled ||
                  runtimeState(row).state !== 'APPLIED'
                }
                onClick={() => onIntent({ action: 'DEFAULT', row })}
              >
                设为默认
              </Button>
              <Button
                size="small"
                type="link"
                danger
                disabled={!writable || row.isDefault || row.referenceCount > 0}
                title={
                  row.isDefault
                    ? '当前默认配置不能删除'
                    : row.referenceCount > 0
                    ? '存在历史引用，不能删除'
                    : undefined
                }
                onClick={() => onIntent({ action: 'DELETE', row })}
              >
                删除
              </Button>
            </div>
          ),
        },
      ]}
    />
  );
}
