import { useLatestRef } from '@/hooks/useLatestRef';
import type { SessionBootstrapState } from '@/utils/sessionBootstrap';
import { createSessionRecoveryController } from '@/utils/sessionBootstrap';
import { Button, Result, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';

type Props = {
  read: (signal: AbortSignal) => Promise<SessionBootstrapState>;
  apply: (state: SessionBootstrapState) => void | Promise<void>;
  onLogout: () => Promise<void>;
};

export default function SessionRecovery(props: Props) {
  const liveRef = useLatestRef(props);
  const controller =
    useRef<ReturnType<typeof createSessionRecoveryController>>(undefined);
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const current = createSessionRecoveryController({
      read: (signal) => liveRef.current.read(signal),
      apply: (state) => liveRef.current.apply(state),
      loading: setLoading,
    });
    controller.current = current;
    return () => {
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [liveRef]);
  return (
    <Result
      status="warning"
      title="会话暂未恢复"
      subTitle="暂时无法读取身份与权限资源，已暂停显示受保护内容。请重试，成功后返回工作台；也可退出登录。"
      extra={
        <Space wrap>
          <Button
            aria-label="重试"
            type="primary"
            loading={loading}
            disabled={exiting}
            onClick={() => {
              void controller.current?.retry();
            }}
          >
            重试
          </Button>
          <Button
            loading={exiting}
            onClick={() => {
              controller.current?.dispose();
              setExiting(true);
              void liveRef.current.onLogout();
            }}
          >
            退出登录
          </Button>
        </Space>
      }
    />
  );
}
