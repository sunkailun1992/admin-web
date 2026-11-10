import PageContainer from '@/components/AppPageContainer';
import { ModelRouteWorkbench } from '@/pages/Ai/Model';
import { getAiModelControlPlane } from '@/services/ai/controlPlane';
import { ReloadOutlined } from '@ant-design/icons';
import { useAccess, useModel } from '@umijs/max';
import { Alert, Button, Skeleton } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { ControlPlaneState } from './controlPlaneModel';
import { createControlPlaneController } from './controlPlaneModel';
import styles from './index.less';
import ModelControlPlaneView from './ModelControlPlaneView';

function ModelConfigurationWorkbench({ scope }: { scope: string }) {
  const liveScope = useRef(scope);
  liveScope.current = scope;
  const controller = useRef<ReturnType<typeof createControlPlaneController>>();
  const [state, setState] = useState<ControlPlaneState>({ phase: 'idle' });
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState<AiAPI.ModelCapability>();
  useEffect(() => {
    const current = createControlPlaneController({
      scope,
      liveScope: () => liveScope.current,
      read: getAiModelControlPlane,
      changed: setState,
    });
    controller.current = current;
    void current.load();
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [scope]);
  const loading = state.phase === 'loading' || state.phase === 'idle';
  return (
    <PageContainer
      title="模型与能力"
      subTitle="原生模型管理、真实部署目录与业务默认路由"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void controller.current?.load()}
        >
          刷新目录
        </Button>,
      ]}
    >
      <div className={styles.page}>
        {state.phase === 'error' ? (
          <Alert
            showIcon
            type="error"
            message="模型目录读取失败"
            description="无法确认当前目录。请重新读取；没有自动发起模型验证或修改。"
            action={
              <Button onClick={() => void controller.current?.load()}>
                重新读取
              </Button>
            }
          />
        ) : null}
        {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : null}
        {state.data ? (
          <ModelControlPlaneView
            data={state.data}
            query={query}
            selectedCapability={capability}
            onQuery={setQuery}
            onCapability={setCapability}
          />
        ) : null}
        <ModelRouteWorkbench identityScope={scope} canChange embedded />
      </div>
    </PageContainer>
  );
}

export default function ModelConfigurationPage() {
  const { initialState } = useModel('@@initialState');
  const access = useAccess();
  const userId = initialState?.currentUser?.userId;
  const tenantId =
    initialState?.currentTenantId || initialState?.currentUser?.tenantId;
  if (!userId || !tenantId || !access.canManageConfiguration)
    return (
      <PageContainer title="模型与能力">
        <Alert
          type="warning"
          showIcon
          message="需要平台超级管理员身份与用户中心管理权限"
        />
      </PageContainer>
    );
  const scope = JSON.stringify([
    userId,
    tenantId,
    access.canManageConfiguration,
  ]);
  return <ModelConfigurationWorkbench key={scope} scope={scope} />;
}
