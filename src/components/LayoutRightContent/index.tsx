import { ADMIN_TYPE_VALUE_ENUM } from '@/constants/auth';
import { clearAccessToken } from '@/utils/auth';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Avatar, Descriptions, Dropdown, Modal } from 'antd';
import { useState } from 'react';

const loginPath = '/login';
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
  setInitialState: (state: Record<string, unknown>) => void;
}

export default function LayoutRightContent({
  initialState,
  setInitialState,
}: LayoutRightContentProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const logout = () => {
    clearAccessToken();
    setInitialState({});
    history.push(loginPath);
  };

  const avatar = (
    <span className="umi-plugin-layout-action">
      {!disableAvatarImg ? (
        <Avatar
          alt="avatar"
          className="umi-plugin-layout-avatar"
          size="small"
          src={initialState?.avatar || defaultAvatar}
        />
      ) : null}
      <span className={nameClassName}>{initialState?.name || displayName}</span>
    </span>
  );

  return (
    <>
      <div className="umi-plugin-layout-right anticon">
        <Dropdown
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
