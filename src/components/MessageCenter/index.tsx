import {
  countCurrentUnreadMessages,
  queryCurrentUserMessages,
  readCurrentUserMessage,
} from '@/services/message';
import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Empty, List, Modal, Popover, Space, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MessageCenterProps {
  currentTenantId?: string;
  currentUser?: API.CurrentUser;
}

export default function MessageCenter({
  currentTenantId,
  currentUser,
}: MessageCenterProps) {
  const loadingRef = useRef(false);
  const [normalUnreadCount, setNormalUnreadCount] = useState(0);
  const [normalMessages, setNormalMessages] = useState<MessageAPI.UserMessageVO[]>(
    [],
  );
  const [systemNotice, setSystemNotice] = useState<MessageAPI.UserMessageVO>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const loadNormalMessages = useCallback(async () => {
    if (!currentTenantId || !currentUser) {
      setNormalUnreadCount(0);
      setNormalMessages([]);
      return;
    }
    const [count, page] = await Promise.all([
      countCurrentUnreadMessages({
        tenantId: currentTenantId,
        messageType: 'NORMAL_MESSAGE',
      }),
      queryCurrentUserMessages({
        tenantId: currentTenantId,
        current: 1,
        size: 5,
        messageType: 'NORMAL_MESSAGE',
        readState: 'UNREAD',
        assignment: false,
      }),
    ]);
    setNormalUnreadCount(count);
    setNormalMessages(page.data || []);
  }, [currentTenantId, currentUser]);

  const loadSystemNotice = useCallback(async () => {
    if (!currentTenantId || !currentUser || loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    try {
      const page = await queryCurrentUserMessages({
        tenantId: currentTenantId,
        current: 1,
        size: 1,
        messageType: 'SYSTEM_NOTICE',
        readState: 'UNREAD',
        assignment: false,
      });
      setSystemNotice(page.data?.[0]);
    } finally {
      loadingRef.current = false;
    }
  }, [currentTenantId, currentUser]);

  const reloadMessages = useCallback(async () => {
    await Promise.all([loadNormalMessages(), loadSystemNotice()]);
  }, [loadNormalMessages, loadSystemNotice]);

  useEffect(() => {
    reloadMessages();
    const timer = window.setInterval(() => {
      reloadMessages();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [reloadMessages]);

  const markNormalMessageRead = async (id: string) => {
    if (!currentTenantId) {
      return;
    }
    await readCurrentUserMessage(id, currentTenantId);
    await loadNormalMessages();
  };

  const closeSystemNotice = async () => {
    if (!currentTenantId || !systemNotice?.id) {
      setSystemNotice(undefined);
      return;
    }
    const currentNoticeId = systemNotice.id;
    setSystemNotice(undefined);
    await readCurrentUserMessage(currentNoticeId, currentTenantId);
    await loadSystemNotice();
  };

  const popoverContent = (
    <div style={{ width: 360 }}>
      {normalMessages.length ? (
        <List
          dataSource={normalMessages}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="read"
                  size="small"
                  type="link"
                  onClick={() => markNormalMessageRead(item.id)}
                >
                  已读
                </Button>,
              ]}
            >
              <List.Item.Meta
                description={
                  <Typography.Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 0 }}
                  >
                    {item.content}
                  </Typography.Paragraph>
                }
                title={
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Typography.Text type="secondary">
                      {item.sendDateTime || '-'}
                    </Typography.Text>
                  </Space>
                }
              />
            </List.Item>
          )}
          size="small"
        />
      ) : (
        <Empty description="暂无未读消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );

  if (!currentUser) {
    return null;
  }

  return (
    <>
      <Popover
        content={popoverContent}
        onOpenChange={setPopoverOpen}
        open={popoverOpen}
        placement="bottomRight"
        title="正常消息"
        trigger="click"
      >
        <span className="umi-plugin-layout-action">
          <Badge count={normalUnreadCount} size="small">
            <BellOutlined style={{ fontSize: 16 }} />
          </Badge>
        </span>
      </Popover>
      <Modal
        destroyOnHidden
        okText="知道了"
        onCancel={closeSystemNotice}
        onOk={closeSystemNotice}
        open={!!systemNotice}
        title={systemNotice?.title || '系统提醒'}
        width={520}
      >
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {systemNotice?.content}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
