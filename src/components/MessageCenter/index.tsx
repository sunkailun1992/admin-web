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
    try { // 当前用户消息属于顶部后台轮询，失败时不应打断主页面操作。
      const [count, page] = await Promise.all([ // 并发查询未读数量和未读列表，减少顶部消息入口刷新延迟。
        countCurrentUnreadMessages(
          { // 未读数量查询只统计当前租户的普通消息。
            tenantId: currentTenantId, // 使用当前登录租户，避免跨租户统计消息。
            messageType: 'NORMAL_MESSAGE', // 铃铛只展示普通消息，系统通知由弹窗单独处理。
          }, // 结束未读数量查询参数。
          { skipErrorHandler: true }, // 轮询失败由组件内部静默兜底，避免全局 message 反复提示 403。
        ),
        queryCurrentUserMessages(
          { // 查询铃铛下拉展示的普通未读消息。
            tenantId: currentTenantId, // 使用当前登录租户，保持与后端租户隔离一致。
            current: 1, // 顶部入口只取第一页作为快速提醒。
            size: 5, // 下拉区域最多展示 5 条，避免撑开顶部菜单。
            messageType: 'NORMAL_MESSAGE', // 普通消息进入铃铛提醒，不触发系统弹窗。
            readState: 'UNREAD', // 只展示未读消息，已读消息不占用提醒空间。
            assignment: false, // 顶部提醒不需要额外填充发送人等管理展示字段。
          }, // 结束普通消息分页查询参数。
          { skipErrorHandler: true }, // 轮询失败由组件内部静默兜底，避免全局 message 反复提示 403。
        ),
      ]);
      setNormalUnreadCount(count); // 请求成功时刷新铃铛角标数量。
      setNormalMessages(page.data || []); // 请求成功时刷新铃铛下拉消息列表。
    } catch { // 消息服务未启动或认证失败时进入静默兜底。
      setNormalUnreadCount(0); // 清空角标，避免展示过期未读数量。
      setNormalMessages([]); // 清空列表，避免展示过期未读消息。
    }
  }, [currentTenantId, currentUser]);

  const loadSystemNotice = useCallback(async () => {
    if (!currentTenantId || !currentUser || loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    try {
      const page = await queryCurrentUserMessages( // 查询当前用户最新一条未读系统通知。
        { // 系统通知查询参数。
          tenantId: currentTenantId, // 使用当前登录租户，避免跨租户弹窗。
          current: 1, // 系统弹窗一次只展示一条，关闭后再加载下一条。
          size: 1, // 保持弹窗提醒单条处理，避免多条同时打扰用户。
          messageType: 'SYSTEM_NOTICE', // 系统通知使用弹窗展示，不进入普通铃铛列表。
          readState: 'UNREAD', // 只拉取未读系统通知，已读通知不重复弹出。
          assignment: false, // 系统弹窗只需要标题和内容，不需要管理端扩展字段。
        }, // 结束系统通知分页查询参数。
        { skipErrorHandler: true }, // 轮询失败由组件内部静默兜底，避免全局 message 反复提示 403。
      );
      setSystemNotice(page.data?.[0]); // 存在未读系统通知时打开弹窗。
    } catch { // 消息服务未启动或认证失败时进入静默兜底。
      setSystemNotice(undefined); // 清空系统弹窗，避免未处理异常残留到页面。
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
