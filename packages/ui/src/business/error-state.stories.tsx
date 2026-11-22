import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { ErrorState } from './error-state.tsx';

const meta = {
  title: '业务组件/ErrorState',
  component: ErrorState,
  args: { title: '加载失败' },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRetry: Story = {
  args: { onRetry: fn() },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '重试' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const WithoutRetry: Story = {};
