import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './empty-state.tsx';

const meta = {
  title: '业务组件/EmptyState',
  component: EmptyState,
  args: { title: '暂无数据' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};
export const WithDescription: Story = {
  args: { description: '换个条件再查。' },
};
