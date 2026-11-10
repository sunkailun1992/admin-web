import PageContainer from '@/components/AppPageContainer';
import { getAiModelSelection, updateAiModelSelection } from '@/services/ai';
import { ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { ProForm, ProFormSelect } from '@ant-design/pro-components';
import { useAccess, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Modal,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import styles from './index.less';
import ModelRouteOverview from './ModelRouteOverview';
import type { ModelSelectionState } from './modelSelectionModel';
import {
  createModelSelectionController,
  providerLabel,
} from './modelSelectionModel';

type Controller = ReturnType<typeof createModelSelectionController>;

function ModelRouteWorkbench({
  identityScope,
  canChange,
}: {
  identityScope: string;
  canChange: boolean;
}) {
  const liveScope = useRef(identityScope);
  liveScope.current = identityScope;
  const allowed = useRef(canChange);
  allowed.current = canChange;
  const controller = useRef<Controller>();
  const [state, setState] = useState<ModelSelectionState>({ phase: 'idle' });
  const [form] = Form.useForm<AiAPI.ModelSelectionUpdateBO>();
  const candidate = Form.useWatch('provider', form) as
    | AiAPI.ModelProvider
    | undefined;
  const [confirmProvider, setConfirmProvider] = useState<AiAPI.ModelProvider>();
  const selection = state.selection;
  const busy = ['idle', 'loading', 'saving', 'checking'].includes(state.phase);
  const canEdit = canChange && state.phase === 'ready';
  const canSubmit =
    canEdit &&
    !!candidate &&
    candidate !== selection?.provider &&
    !!selection?.supportedProviders?.includes(candidate);

  useEffect(() => {
    const current = createModelSelectionController({
      scope: identityScope,
      liveScope: () => liveScope.current,
      canChange: () => allowed.current,
      read: getAiModelSelection,
      write: updateAiModelSelection,
      changed: setState,
    });
    controller.current = current;
    void current.load();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [identityScope]);

  useEffect(() => {
    if (canChange) form.resetFields();
  }, [selection, form, canChange]);

  return (
    <PageContainer
      title="AI 模型路由"
      subTitle="查看当前默认路由，管理服务支持的供应商选择"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={busy}
          disabled={state.phase === 'saving'}
          onClick={() => {
            void controller.current?.load();
          }}
        >
          {state.phase === 'uncertain' ? '只读查回' : '刷新路由'}
        </Button>,
      ]}
    >
      <div className={styles.workbench}>
        {!canChange ? (
          <Alert
            showIcon
            type="info"
            message="当前账户只读"
            description="更改全局默认路由需同时具备平台超级管理员身份与用户中心管理权限。"
          />
        ) : null}
        {state.error ? (
          <Alert
            showIcon
            type={state.phase === 'uncertain' ? 'warning' : 'error'}
            message={
              state.phase === 'load-error'
                ? '路由加载失败'
                : state.phase === 'uncertain'
                ? '提交结果尚未确认'
                : '路由操作未完成'
            }
            description={state.error}
            action={
              <Button
                size="small"
                loading={busy}
                disabled={state.phase === 'saving'}
                onClick={() => {
                  void controller.current?.load();
                }}
              >
                {state.phase === 'uncertain' ? '只读查回' : '重新读取'}
              </Button>
            }
          />
        ) : null}
        {state.phase === 'checking' ? (
          <Alert
            showIcon
            type="warning"
            message="正在只读核对当前路由"
            description="提交结果不明，未自动重复变更。"
          />
        ) : null}
        {state.notice === 'saved' ? (
          <Alert showIcon type="success" message="默认路由已更新" />
        ) : null}
        {state.notice === 'readback' ? (
          <Alert
            showIcon
            type="info"
            message="已重新读取当前路由"
            description="下方展示服务此刻返回的配置。上次提交未自动重发，读回不代表已确认原请求的执行过程。"
          />
        ) : null}
        {selection ? (
          <ModelRouteOverview
            selection={selection}
            stale={state.phase !== 'ready'}
          />
        ) : busy ? (
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        ) : null}
        {canChange ? (
          <Card
            title="更改全局默认路由"
            extra={
              <Typography.Text type="secondary">影响所有租户</Typography.Text>
            }
          >
            <Typography.Paragraph type="secondary">
              选择服务支持的目标供应商。确认后，后续使用默认路由的 AI
              请求将使用该供应商；实际模型由执行层配置解析。
            </Typography.Paragraph>
            <ProForm<AiAPI.ModelSelectionUpdateBO>
              form={form}
              layout="vertical"
              submitter={false}
              className={styles.changeForm}
              disabled={!canEdit}
            >
              <ProFormSelect
                name="provider"
                label="目标供应商"
                placeholder="请选择目标供应商"
                options={(selection?.supportedProviders || []).map(
                  (provider) => ({
                    value: provider,
                    label: `${providerLabel(provider)}${
                      provider === selection?.provider ? '（当前默认）' : ''
                    }`,
                    disabled: provider === selection?.provider,
                  }),
                )}
                fieldProps={{ allowClear: true }}
              />
            </ProForm>
            {!selection?.supportedProviders?.length ? (
              <Typography.Text type="secondary">
                读取有效支持项后才能变更。
              </Typography.Text>
            ) : null}
            <Space wrap className={styles.actions}>
              <Button
                type="primary"
                icon={<SwapOutlined />}
                loading={state.phase === 'saving'}
                disabled={!canSubmit}
                onClick={() => {
                  if (candidate && controller.current?.canSave(candidate))
                    setConfirmProvider(candidate);
                }}
              >
                确认变更
              </Button>
              <Button
                disabled={!canEdit || !candidate}
                onClick={() => form.resetFields()}
              >
                清除选择
              </Button>
            </Space>
          </Card>
        ) : null}
      </div>
      <Modal
        title="更改全局默认路由？"
        open={!!confirmProvider}
        okText="变更全局默认路由"
        cancelText="取消"
        okButtonProps={{
          disabled:
            !canEdit ||
            !confirmProvider ||
            !controller.current?.canSave(confirmProvider),
        }}
        onCancel={() => setConfirmProvider(undefined)}
        onOk={() => {
          const provider = confirmProvider;
          setConfirmProvider(undefined);
          if (provider) void controller.current?.save(provider, true);
        }}
      >
        <Alert
          type="warning"
          showIcon
          message="此操作会影响所有租户后续使用默认路由的 AI 请求。"
        />
        <Descriptions column={1} size="small" className={styles.actions}>
          <Descriptions.Item label="当前供应商">
            {selection ? providerLabel(selection.provider) : '尚未读取'}
          </Descriptions.Item>
          <Descriptions.Item label="当前模型">
            <span className={styles.confirmationValue}>
              {selection?.model || '服务未返回模型名称'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="目标供应商">
            {confirmProvider ? providerLabel(confirmProvider) : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </PageContainer>
  );
}

export default function AiModelPage() {
  const { initialState } = useModel('@@initialState');
  const access = useAccess();
  const userId = initialState?.currentUser?.userId;
  const tenantId =
    initialState?.currentTenantId || initialState?.currentUser?.tenantId;
  const canChange = access.canChangeAiModel === true;
  const identityScope = JSON.stringify([userId, tenantId, canChange]);
  if (!userId || !tenantId)
    return (
      <PageContainer title="AI 模型路由">
        <Alert type="info" showIcon message="请先登录以读取模型路由" />
      </PageContainer>
    );
  return (
    <ModelRouteWorkbench
      key={identityScope}
      identityScope={identityScope}
      canChange={canChange}
    />
  );
}
