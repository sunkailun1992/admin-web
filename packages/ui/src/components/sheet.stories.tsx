import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const meta = { title: '基础组件/Sheet', component: Sheet } satisfies Meta<
  typeof Sheet
>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpensAndClosesWithEscape: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>打开抽屉</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>上传知识文档</SheetTitle>
          <SheetDescription>选择文件后上传并校验。</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '打开抽屉' }));
    const body = within(document.body);
    const sheet = await body.findByRole('dialog', { name: '上传知识文档' });
    await expect(sheet.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};
