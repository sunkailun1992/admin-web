import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { expect, fn, within } from 'storybook/test';
import { z } from 'zod';
import { Input } from '../components/input.tsx';
import { Label } from '../components/label.tsx';
import { FormDialog, type FormDialogProps } from './form-dialog.tsx';
import { GeneratedCodeInput } from './generated-code-input.tsx';

const schema = z.object({
  name: z.string().min(1, '请填写名称'),
  code: z.string().min(1, '请生成编码'),
});

type Schema = typeof schema;

function DeptFields({
  form,
}: {
  form: UseFormReturn<z.input<Schema>, unknown, z.output<Schema>>;
}) {
  return (
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
  );
}

// 故事里自己管打开状态；弹层一打开就显示，页面上没有被遮住的可聚焦元素。
function StatefulFormDialog(props: FormDialogProps<Schema>) {
  const [open, setOpen] = useState(props.open);
  return (
    <FormDialog
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange(next);
      }}
    />
  );
}

const meta = {
  title: '业务组件/FormDialog',
  component: FormDialog<Schema>,
  args: {
    open: true,
    onOpenChange: fn(),
    title: '新建部门',
    description: '编码由后端生成。',
    schema,
    defaultValues: { name: '', code: '' },
    onSubmit: fn(async () => {}),
    children: (form) => <DeptFields form={form} />,
  },
  render: (args) => <StatefulFormDialog {...args} />,
} satisfies Meta<typeof FormDialog<Schema>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValidatesBeforeSubmit: Story = {
  play: async ({ args, userEvent }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: '保存' }));
    await expect(await body.findByText('请填写名称')).toBeVisible();
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(body.getByRole('dialog', { name: '新建部门' })).toBeVisible();
  },
};

export const GeneratesCodeInSheet: Story = {
  args: { variant: 'sheet' },
  play: async ({ userEvent }) => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: '生成' }));
    await expect(body.getByLabelText('编码')).toHaveValue('DEPT_0001');
  },
};
