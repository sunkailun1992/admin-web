import PageContainer from '@/components/AppPageContainer';
import {
  createStorageConfiguration,
  deleteStorageConfiguration,
  getStorageCapabilities,
  getStorageOperation,
  getStorageSettings,
  listStorageConfigurations,
  probeStorageConfiguration,
  updateStorageConfiguration,
  updateStorageSettings,
} from '@/services/ai/storage';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import styles from './index.less';
import type { StorageFormValues } from './StorageConfigurationDrawer';
import StorageConfigurationDrawer from './StorageConfigurationDrawer';
import type { StorageRowIntent } from './StorageConfigurationTable';
import StorageConfigurationTable from './StorageConfigurationTable';
import type { StorageState } from './storageModel';
import {
  createPayload,
  createStorageController,
  createStoragePendingStore,
  createStorageRequestId,
  settingsPayload,
  updatePayload,
} from './storageModel';
import StorageOperationDrawer from './StorageOperationDrawer';
import StorageSettingsPanel from './StorageSettingsPanel';

const validationKey = '00000000-0000-4000-8000-000000000000';
function StorageWorkbench({
  scope,
  liveScope,
  canManage,
}: {
  scope: string;
  liveScope: () => string;
  canManage: () => boolean;
}) {
  const controller = useRef<ReturnType<typeof createStorageController>>();
  const [state, setState] = useState<StorageState>({ phase: 'idle' });
  const [query, setQuery] = useState<AiAPI.StorageListQuery>({
    page: 1,
    size: 20,
  });
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState<AiAPI.StorageProvider>();
  const [uploadEnabled, setUploadEnabled] = useState<boolean>();
  const [editor, setEditor] = useState<{
    current?: AiAPI.StorageConfigurationVO;
  }>();
  const [intent, setIntent] = useState<StorageRowIntent>();
  const [operationOpen, setOperationOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  useEffect(() => {
    let store;
    try {
      store = createStoragePendingStore(window.sessionStorage, scope);
    } catch {
      store = {
        load: () => {
          throw new Error('SESSION_STORAGE_UNAVAILABLE');
        },
        save: () => {},
        clear: () => {},
      };
    }
    const current = createStorageController({
      scope,
      liveScope,
      canManage,
      store,
      requestId: () => createStorageRequestId(),
      read: async (query, options) => {
        const [list, settings, capabilities] = await Promise.all([
          listStorageConfigurations(query, options),
          getStorageSettings(options),
          getStorageCapabilities(options),
        ]);
        return { list, settings, capabilities };
      },
      lookup: getStorageOperation,
      changed: setState,
    });
    controller.current = current;
    void current.load();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [scope]);
  useEffect(() => {
    if (state.pending) setOperationOpen(true);
  }, [state.pending?.requestId]);
  const snapshot = state.snapshot;
  const busy = ['idle', 'loading', 'submitting', 'checking'].includes(
    state.phase,
  );
  const writable = state.phase === 'ready' && !state.pending && canManage();
  const load = (next: AiAPI.StorageListQuery) => {
    setQuery(next);
    void controller.current?.load(next);
  };
  const submit = (
    action: AiAPI.StorageAction,
    id: string | null,
    invoke: Parameters<ReturnType<typeof createStorageController>['submit']>[2],
  ) => {
    if (!controller.current?.canSubmit()) return false;
    setFormError(undefined);
    setOperationOpen(true);
    void controller.current.submit(action, id, invoke, true);
    return true;
  };
  const saveConfiguration = (values: StorageFormValues) => {
    if (!snapshot || !editor || !writable) return false;
    try {
      if (editor.current) {
        const row = editor.current;
        const payload = updatePayload(
          values as unknown as Record<string, unknown>,
          row,
          validationKey,
        );
        if (
          !submit('UPDATE', row.id, (requestId, options) =>
            updateStorageConfiguration(
              row.id,
              { ...payload, requestId },
              options,
            ),
          )
        )
          return false;
      } else {
        const payload = createPayload(
          values as unknown as Record<string, unknown>,
          snapshot.capabilities,
          validationKey,
        );
        if (
          !submit('CREATE', null, (requestId, options) =>
            createStorageConfiguration({ ...payload, requestId }, options),
          )
        )
          return false;
      }
      setEditor(undefined);
      return true;
    } catch {
      setFormError(
        '表单未通过校验。请核对供应商、完整服务地址、桶、区域和成对凭据；本次没有发送请求。',
      );
      return false;
    }
  };
  const saveSettings = (
    values: Pick<
      AiAPI.StorageSettingsVO,
      | 'defaultPlatform'
      | 'uploadTtlSeconds'
      | 'viewTtlSeconds'
      | 'maxUploadBytes'
    >,
  ) => {
    if (!snapshot || !writable) return false;
    try {
      const payload = settingsPayload(
        values,
        snapshot.settings,
        snapshot.capabilities,
        validationKey,
      );
      return submit('UPDATE_SETTINGS', null, (requestId, options) =>
        updateStorageSettings({ ...payload, requestId }, options),
      );
    } catch {
      setFormError(
        '策略未通过校验，请核对默认平台、秒数和文件大小限制。本次没有发送请求。',
      );
      return false;
    }
  };
  const confirmIntent = () => {
    if (!intent || !snapshot || !writable) return;
    const { row, action } = intent;
    if (action === 'DELETE') {
      if (row.isDefault || row.referenceCount > 0) return;
      submit('DELETE', row.id, (requestId, options) =>
        deleteStorageConfiguration(
          row.id,
          { requestId, expectedVersion: row.version },
          options,
        ),
      );
    } else if (action === 'PROBE')
      submit('PROBE', row.id, (requestId, options) =>
        probeStorageConfiguration(
          row.id,
          { requestId, expectedVersion: row.version, mode: 'READ_WRITE' },
          options,
        ),
      );
    else if (action === 'TOGGLE')
      submit('UPDATE', row.id, (requestId, options) =>
        updateStorageConfiguration(
          row.id,
          {
            requestId,
            expectedVersion: row.version,
            name: row.name,
            uploadEnabled: !row.uploadEnabled,
            credentialAction: 'KEEP',
          },
          options,
        ),
      );
    else saveSettings({ ...snapshot.settings, defaultPlatform: row.platform });
    setIntent(undefined);
  };
  return (
    <PageContainer
      title="文件存储"
      subTitle="统一管理私有对象存储与新上传策略，历史文件保留原平台读取"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={busy}
          disabled={state.phase === 'submitting' || state.phase === 'blocked'}
          onClick={() => void controller.current?.load(query)}
        >
          {state.pending ? '只读查回' : '刷新配置'}
        </Button>,
        <Button
          key="new"
          type="primary"
          icon={<PlusOutlined />}
          disabled={
            !writable ||
            !snapshot?.capabilities.providers.some(
              (entry) => entry.availability === 'AVAILABLE',
            )
          }
          onClick={() => {
            setFormError(undefined);
            setEditor({});
          }}
        >
          新增存储
        </Button>,
      ]}
    >
      <div className={styles.workbench}>
        <Alert
          showIcon
          type="info"
          message="配置保存、生效和读写验证分别展示"
          description="文件存储由本工作台与服务端动态注册管理。环境连接及加密根配置仍由部署配置负责；不会把密钥写入浏览器存储或回显。"
        />
        {state.error ? (
          <Alert
            showIcon
            type={
              state.pending || state.phase === 'blocked' ? 'warning' : 'error'
            }
            message={state.error}
            action={
              state.pending ? (
                <Button
                  loading={state.phase === 'checking'}
                  disabled={
                    state.phase === 'blocked' || state.phase === 'submitting'
                  }
                  onClick={() => void controller.current?.lookup()}
                >
                  只读查回
                </Button>
              ) : state.phase !== 'blocked' ? (
                <Button onClick={() => void controller.current?.load(query)}>
                  重新读取
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {formError ? (
          <Alert
            closable
            onClose={() => setFormError(undefined)}
            showIcon
            type="error"
            message={formError}
          />
        ) : null}
        {state.pending ? (
          <Alert
            showIcon
            type="warning"
            message="存在尚未确认的存储操作"
            description="新变更已暂停，继续用原请求标识查回终态。"
            action={
              <Button onClick={() => setOperationOpen(true)}>查看原操作</Button>
            }
          />
        ) : null}
        {!snapshot && busy ? <Skeleton active paragraph={{ rows: 5 }} /> : null}
        {snapshot ? (
          <>
            <StorageSettingsPanel
              settings={snapshot.settings}
              capabilities={snapshot.capabilities}
              configurations={snapshot.list.items}
              disabled={!writable}
              onSubmit={saveSettings}
            />
            <Card
              title="存储配置"
              size="small"
              extra={
                state.operation ? (
                  <Button type="link" onClick={() => setOperationOpen(true)}>
                    最近操作
                  </Button>
                ) : null
              }
            >
              <Space wrap className={styles.filters}>
                <Input.Search
                  allowClear
                  aria-label="搜索存储配置"
                  className={styles.search}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onSearch={() =>
                    load({
                      page: 1,
                      size: query.size,
                      search: search.trim() || undefined,
                      provider,
                      uploadEnabled,
                    })
                  }
                  placeholder="名称、平台标识或桶"
                  disabled={!writable}
                />
                <Select
                  allowClear
                  className={styles.provider}
                  aria-label="筛选存储供应商"
                  placeholder="全部供应商"
                  value={provider}
                  disabled={!writable}
                  onChange={(value) => {
                    setProvider(value);
                    load({
                      page: 1,
                      size: query.size,
                      search: search.trim() || undefined,
                      provider: value,
                      uploadEnabled,
                    });
                  }}
                  options={snapshot.capabilities.providers.map((entry) => ({
                    value: entry.code,
                    label: entry.label,
                  }))}
                />
                <Select
                  allowClear
                  style={{ width: 150 }}
                  aria-label="筛选新上传状态"
                  placeholder="全部上传状态"
                  value={uploadEnabled}
                  disabled={!writable}
                  onChange={(value) => {
                    setUploadEnabled(value);
                    load({
                      page: 1,
                      size: query.size,
                      search: search.trim() || undefined,
                      provider,
                      uploadEnabled: value,
                    });
                  }}
                  options={[
                    { value: true, label: '允许新上传' },
                    { value: false, label: '已停用新上传' },
                  ]}
                />
              </Space>
              <StorageConfigurationTable
                list={snapshot.list}
                capabilities={snapshot.capabilities}
                writable={writable}
                loading={state.phase === 'loading'}
                onPage={(page, size) => load({ ...query, page, size })}
                onEdit={(row) => {
                  setFormError(undefined);
                  setEditor({ current: row });
                }}
                onIntent={setIntent}
              />
            </Card>
            {editor ? (
              <StorageConfigurationDrawer
                open
                current={editor.current}
                capabilities={snapshot.capabilities}
                disabled={!writable}
                onClose={() => {
                  setEditor(undefined);
                  setFormError(undefined);
                }}
                onSubmit={saveConfiguration}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <StorageOperationDrawer
        open={operationOpen}
        state={state}
        onClose={() => setOperationOpen(false)}
        onLookup={() => void controller.current?.lookup()}
      />
      <Modal
        title={
          intent?.action === 'DELETE'
            ? '删除存储配置？'
            : intent?.action === 'PROBE'
            ? '执行一次读写探测？'
            : intent?.action === 'DEFAULT'
            ? '切换全局默认存储？'
            : intent?.row.uploadEnabled
            ? '停用新上传？'
            : '启用新上传？'
        }
        open={!!intent}
        okText="确认操作"
        cancelText="取消"
        okButtonProps={{
          disabled: !writable,
          danger: intent?.action === 'DELETE',
        }}
        onCancel={() => setIntent(undefined)}
        onOk={confirmIntent}
      >
        <Typography.Paragraph className={styles.longValue}>
          {intent?.row.name}
        </Typography.Paragraph>
        <Alert
          showIcon
          type="warning"
          message={
            intent?.action === 'PROBE'
              ? '将写入、读取并清理本轮合成探测对象，可能产生存储请求费用。'
              : intent?.action === 'DELETE'
              ? '只删除无引用、非默认配置的管理元数据，不删除桶或历史文件。'
              : '影响后续新上传，历史文件仍按原平台读取，不搬移对象。'
          }
        />
      </Modal>
    </PageContainer>
  );
}

export default function StorageConfigurationPage() {
  const { initialState } = useModel('@@initialState');
  const access = useAccess();
  const userId = initialState?.currentUser?.userId;
  const tenantId =
    initialState?.currentTenantId || initialState?.currentUser?.tenantId;
  const allowed =
    access.canManageConfiguration === true && !!userId && !!tenantId;
  const scope = allowed ? JSON.stringify([userId, tenantId, true]) : '';
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const permission = useRef(allowed);
  permission.current = allowed;
  if (!allowed)
    return (
      <PageContainer title="文件存储">
        <Alert
          showIcon
          type="warning"
          message="需要平台超级管理员身份与用户中心管理权限"
        />
      </PageContainer>
    );
  return (
    <StorageWorkbench
      key={scope}
      scope={scope}
      liveScope={() => liveScope.current}
      canManage={() => permission.current}
    />
  );
}
