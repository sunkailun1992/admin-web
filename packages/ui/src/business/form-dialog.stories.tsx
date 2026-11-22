import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { expect, within } from 'storybook/test';
import { z } from 'zod';
import { Input } from '../components/input.tsx';
import { Label } from '../components/label.tsx';
import { FormDialog } from './form-dialog.tsx';
import { GeneratedCodeInput } from './generated-code-input.tsx';

const schema = z.object({
  name: z.string().min(1, '请填写名称'),
  code: z.string().min(1, '请生成编码'),
});

function DeptForm({ variant }: { variant?: 'dialog' | 'sheet' }) {
  // 一打开就显示弹层；外面不放触发按钮，弹层打开时页面上就没有被遮住的可聚焦元素。
  const [open, setOpen] = useState(true);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title="新建部门"
      description="编码由后端生成。"
      schema={schema}
      defaultValues={{ name: '', code: '' }}
      variant={variant}
      onSubmit={async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }}
    >
      {(form) => (
        <>
          <div className="grid gap-2">
            <Label htmlFor="dept-name">名称</Label>
            <Input
              id="dept-name"
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby="dept-name-error"
              {...form.register('name')}
            />
            <p id="dept-name-error" className="text-sm text-destructive">
              {form.formState.errors.name?.message}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dept-code">编码</Label>
            <Controller
              control={form.control}
              name="code"
              render={({ field }) => (
                <GeneratedCodeInput
                  id="dept-code"
                  value={field.value}
                  onChange={field.onChange}
                  generate={async () => 'DEPT_0001'}
                />
              )}
            />
            <p className="text-sm text-destructive">
              {form.formState.errors.code?.message}
            </p>
          </div>
        </>
      )}
    </FormDialog>
  );
}

const meta = { title: '业务组件/FormDialog' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValidatesBeforeSubmit: Story = {
  render: () => <DeptForm />,
  play: async ({ userEvent }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: '保存' }));
    await expect(await body.findByText('请填写名称')).toBeVisible();
    await expect(body.getByRole('dialog', { name: '新建部门' })).toBeVisible();
  },
};

export const GeneratesCodeInSheet: Story = {
  render: () => <DeptForm variant="sheet" />,
  play: async ({ userEvent }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: '生成' }));
    await expect(body.getByLabelText('编码')).toHaveValue('DEPT_0001');
  },
};
