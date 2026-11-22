import type { Meta, StoryObj } from '@storybook/react-vite';
import { DescriptionList } from './description-list.tsx';
import { StatusBadge } from './status-badge.tsx';

const meta = {
  title: '业务组件/DescriptionList',
  component: DescriptionList,
  args: {
    items: [
      { label: '租户', value: '默认租户' },
      { label: '编码', value: 'TENANT_0001' },
      {
        label: '状态',
        value: (
          <StatusBadge
            value="ENABLED"
            options={{ ENABLED: { label: '启用', tone: 'success' } }}
          />
        ),
      },
    ],
  },
} satisfies Meta<typeof DescriptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AccountDetails: Story = {};
