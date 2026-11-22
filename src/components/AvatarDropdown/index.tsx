import { ADMIN_TYPE_VALUE_ENUM } from '@/constants/auth';
import { logout as logoutGatewaySession } from '@/services/auth';
import { clearSelectedTenantId } from '@/utils/auth';
import { logoutAndLeave } from '@/utils/sessionLogin';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { Descriptions, Dropdown, Modal } from 'antd';
import { useState, type ReactNode } from 'react';
import { accountName, type AccountState } from './accountName';

export type { AccountState } from './accountName';

/**
 * 页头账户菜单（ProLayout 的 avatarProps.render 用它包住头像与名称）：账户设置与退出登录。
 * 触发器是带可访问名称的原生按钮，键盘与触屏都能打开；退出时先清掉选中的租户，再经网关注销。
 */
export default function AvatarDropdown({
  initialState,
  children,
}: {
  initialState?: AccountState;
  children: ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = initialState?.currentUser;
  const currentTenant = initialState?.availableTenants?.find(
    (tenant) => tenant.id === initialState.currentTenantId,
  );
  const adminTypeText = currentUser?.adminType
    ? ADMIN_TYPE_VALUE_ENUM[currentUser.adminType]?.text
    : '-';

  const logout = async () => {
    // 网关作废会话后整页导航到 Keycloak 的注销地址，选中的租户一并清掉。
    clearSelectedTenantId();
    await logoutAndLeave(logoutGatewaySession);
  };

  return (
    <>
      <Dropdown
        trigger={['click']}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        menu={{
          items: [
            {
              icon: <SettingOutlined />,
              key: 'settings',
              label: '账户设置',
              onClick: () => setSettingsOpen(true),
            },
            { type: 'divider' },
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
      >
        <button
          type="button"
          aria-label="账户菜单"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            alignItems: 'center',
            background: 'transparent',
            border: 0,
            color: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            font: 'inherit',
            outlineOffset: -3,
            padding: 0,
          }}
        >
          {children}
        </button>
      </Dropdown>
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
          <Descriptions.Item label="昵称">
            {accountName(initialState)}
          </Descriptions.Item>
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
