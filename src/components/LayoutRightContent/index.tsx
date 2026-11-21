import MessageCenter from '@/components/MessageCenter';
import { ADMIN_TYPE_VALUE_ENUM } from '@/constants/auth';
import { logout as logoutGatewaySession } from '@/services/auth';
import { clearSelectedTenantId } from '@/utils/auth';
import { logoutAndLeave } from '@/utils/sessionLogin';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { Avatar, Descriptions, Dropdown, Modal } from 'antd';
import { useState } from 'react';

const defaultAvatar =
  'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png';

interface LayoutRightContentProps {
  initialState?: {
    avatar?: string | false;
    name?: string;
    currentUser?: API.CurrentUser;
    currentTenantId?: string;
    availableTenants?: API.AuthTenantVO[];
  };
}

export default function LayoutRightContent({
  initialState,
}: LayoutRightContentProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const currentUser = initialState?.currentUser;
  const showAvatar = initialState?.avatar || initialState?.name || currentUser;
  const disableAvatarImg = initialState?.avatar === false;
  const nameClassName = disableAvatarImg
    ? 'umi-plugin-layout-name umi-plugin-layout-hide-avatar-img'
    : 'umi-plugin-layout-name';
  const currentTenant = initialState?.availableTenants?.find(
    (tenant) => tenant.id === initialState.currentTenantId,
  );
  const displayName =
    currentUser?.nickname ||
    currentUser?.username ||
    currentUser?.name ||
    initialState?.name ||
    '管理员';
  const adminTypeText = currentUser?.adminType
    ? ADMIN_TYPE_VALUE_ENUM[currentUser.adminType]?.text
    : '-';

  if (!showAvatar) {
    return null;
  }

  const logout = async () => {
    // 网关作废会话后整页导航到 Keycloak 的注销地址，选中的租户一并清掉。
    clearSelectedTenantId();
    await logoutAndLeave(logoutGatewaySession);
  };

  const avatar = (
    <button
      type="button"
      aria-label="账户菜单"
      aria-haspopup="menu"
      aria-expanded={accountMenuOpen}
      className="umi-plugin-layout-action"
      style={{
        background: 'transparent',
        border: 0,
        color: 'inherit',
        font: 'inherit',
        outlineOffset: -3,
      }}
    >
      {!disableAvatarImg ? (
        <Avatar
          alt="avatar"
          className="umi-plugin-layout-avatar"
          size="small"
          src={initialState?.avatar || defaultAvatar}
        />
      ) : null}
      <span className={nameClassName}>{initialState?.name || displayName}</span>
    </button>
  );

  return (
    <>
      <div className="umi-plugin-layout-right anticon">
        {/* 换用户或租户就重新挂载：消息状态回到初值，不会短暂显示上一个身份的未读数与通知。 */}
        <MessageCenter
          key={JSON.stringify([
            currentUser?.userId,
            initialState?.currentTenantId,
          ])}
          currentTenantId={initialState?.currentTenantId}
          currentUser={currentUser}
        />
        <Dropdown
          trigger={['click']}
          open={accountMenuOpen}
          onOpenChange={setAccountMenuOpen}
          menu={{
            className: 'umi-plugin-layout-menu',
            items: [
              {
                icon: <SettingOutlined />,
                key: 'settings',
                label: '账户设置',
                onClick: () => setSettingsOpen(true),
              },
              {
                type: 'divider',
              },
              {
                danger: true,
                icon: <LogoutOutlined />,
                key: 'logout',
                label: '退出登录',
                onClick: logout,
              },
            ],
            selectedKeys: [],
          }}
          overlayClassName="umi-plugin-layout-container"
        >
          {avatar}
        </Dropdown>
      </div>
      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => setSettingsOpen(false)}
        open={settingsOpen}
        title="账户设置"
        width={520}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="用户名">
            {currentUser?.username || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="昵称">{displayName}</Descriptions.Item>
          <Descriptions.Item label="管理员分类">
            {adminTypeText}
          </Descriptions.Item>
          <Descriptions.Item label="当前租户">
            {currentTenant?.name ||
              currentTenant?.code ||
              initialState?.currentTenantId ||
              '-'}
          </Descriptions.Item>
          <Descriptions.Item label="可用租户">
            {initialState?.availableTenants?.length || 0}
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </>
  );
}
