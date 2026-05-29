import { ADMIN_TYPE_VALUE_ENUM } from '@/constants/auth';
import { clearAccessToken } from '@/utils/auth';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { Descriptions, Dropdown, Modal } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';

const loginPath = '/login';

interface LayoutAccountProps {
  defaultDom: ReactNode;
}

export default function LayoutAccount({ defaultDom }: LayoutAccountProps) {
  const { initialState, setInitialState } = useModel('@@initialState');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentUser = initialState?.currentUser;
  const currentTenant = initialState?.availableTenants?.find(
    (tenant) => tenant.id === initialState.currentTenantId,
  );
  const adminTypeText = currentUser?.adminType
    ? ADMIN_TYPE_VALUE_ENUM[currentUser.adminType]?.text
    : '-';
  const displayName =
    currentUser?.nickname || currentUser?.username || currentUser?.name || '管理员';

  const logout = () => {
    clearAccessToken();
    setInitialState({});
    history.push(loginPath);
  };

  return (
    <>
      <Dropdown
        menu={{
          items: [
            {
              icon: <SettingOutlined />,
              key: 'settings',
              label: '账户设置',
            },
            {
              type: 'divider',
            },
            {
              danger: true,
              icon: <LogoutOutlined />,
              key: 'logout',
              label: '退出登录',
            },
          ],
          onClick: ({ key }) => {
            if (key === 'settings') {
              setSettingsOpen(true);
            }
            if (key === 'logout') {
              logout();
            }
          },
        }}
        placement="bottomRight"
        trigger={['click']}
      >
        <span>{defaultDom}</span>
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
