import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { Button } from '../components/button.tsx';
import { Label } from '../components/label.tsx';
import { ConfirmAction } from './confirm-action.tsx';
import { GeneratedCodeInput } from './generated-code-input.tsx';
import { UploadDropzone } from './upload-dropzone.tsx';

const meta = { title: '业务组件/输入与确认' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function CodeDemo() {
  const [value, setValue] = useState('');
  return (
    <div className="grid w-80 gap-2">
      <Label htmlFor="code">编码</Label>
      <GeneratedCodeInput
        id="code"
        value={value}
        onChange={setValue}
        generate={() =>
          new Promise((resolve) => setTimeout(() => resolve('DEPT_0001'), 200))
        }
      />
    </div>
  );
}

export const GeneratedCode: Story = {
  render: () => <CodeDemo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '生成' }));
    await waitFor(() =>
      expect(canvas.getByLabelText('编码')).toHaveValue('DEPT_0001'),
    );
  },
};

const onFiles = fn();

export const UploadWithValidation: Story = {
  render: () => (
    <div className="w-96">
      <UploadDropzone
        label="选择文档"
        accept=".pdf"
        validate={(file) =>
          file.size > 10 * 1024 * 1024 ? '文件不能超过 10 MB' : undefined
        }
        onFiles={onFiles}
      />
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.upload(
      canvas.getByLabelText('选择文档'),
      new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }),
    );
    await expect(onFiles).toHaveBeenCalledTimes(1);
  },
};

const onConfirm = fn(async () => {});

export const ConfirmBeforeDelete: Story = {
  render: () => (
    <ConfirmAction title="确认删除" confirmText="删除" onConfirm={onConfirm}>
      <Button variant="destructive">删除部门</Button>
    </ConfirmAction>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '删除部门' }));
    const body = within(document.body);
    await expect(
      await body.findByRole('alertdialog', { name: '确认删除' }),
    ).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: '删除' }));
    await waitFor(() => expect(body.queryByRole('alertdialog')).toBeNull());
    await expect(onConfirm).toHaveBeenCalledTimes(1);
  },
};
