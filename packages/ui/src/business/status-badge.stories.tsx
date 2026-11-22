import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatusBadge } from './status-badge.tsx';

const TONES = {
  ENABLED: { label: '启用', tone: 'success' },
  PENDING: { label: '处理中', tone: 'warning' },
  FAILED: { label: '失败', tone: 'destructive' },
  DISABLED: { label: '停用', tone: 'default' },
} as const;

const meta = {
  title: '业务组件/StatusBadge',
  component: StatusBadge,
  args: { value: 'ENABLED', options: TONES },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const Warning: Story = { args: { value: 'PENDING' } };
export const Destructive: Story = { args: { value: 'FAILED' } };
export const Neutral: Story = { args: { value: 'DISABLED' } };

/** 枚举里没有的取值原样显示。 */
export const UnknownValue: Story = {
  args: { value: 'UNKNOWN' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('UNKNOWN')).toBeVisible();
  },
};
