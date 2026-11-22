import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { Button } from '../components/button.tsx';
import { ConfirmAction } from './confirm-action.tsx';

const meta = {
  title: '业务组件/ConfirmAction',
  component: ConfirmAction,
  args: {
    title: '确认删除',
    confirmText: '删除',
    onConfirm: fn(async () => {}),
    children: <Button variant="destructive">删除部门</Button>,
  },
} satisfies Meta<typeof ConfirmAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConfirmBeforeDelete: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '删除部门' }));
    const body = within(document.body);
    await expect(
      await body.findByRole('alertdialog', { name: '确认删除' }),
    ).toBeVisible();
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await userEvent.click(body.getByRole('button', { name: '删除' }));
    await waitFor(() => expect(body.queryByRole('alertdialog')).toBeNull());
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

export const CustomDescription: Story = {
  args: { description: '部门下还有用户时不能删除。' },
};
