import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { Button } from './button';

const meta = {
  title: '基础组件/Button',
  component: Button,
  args: { children: '保存', onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '保存' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: '删除' },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: '保存' });
    await expect(button).toBeDisabled();
    // 禁用的按钮带 pointer-events: none，关掉 user-event 的指针检查强行点一次，onClick 也不能被调用。
    await userEvent.setup({ pointerEventsCheck: 0 }).click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
