import { FormDialog } from '@admin-web/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1, '请填写名称') });

function Harness({
  onSubmit,
}: {
  onSubmit: (v: { name: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title="新建部门"
      schema={schema}
      defaultValues={{ name: '' }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <>
          <label htmlFor="name">名称</label>
          <input id="name" {...form.register('name')} />
          <p>{form.formState.errors.name?.message}</p>
        </>
      )}
    </FormDialog>
  );
}

test('FormDialog blocks submit and shows zod error', async () => {
  const onSubmit = vi.fn(async () => {});
  render(<Harness onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByText('请填写名称')).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('disables submit while onSubmit is pending (no double submit)', async () => {
  let resolve: () => void = () => {};
  const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
  render(<Harness onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText('名称'), '研发部');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled(),
  );
  // 按钮已禁用（带 pointer-events: none），关掉指针检查再强点一次，确认不会二次提交。
  await userEvent
    .setup({ pointerEventsCheck: 0 })
    .click(screen.getByRole('button', { name: '保存' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  resolve();
});

test('closes on success', async () => {
  render(<Harness onSubmit={async () => {}} />);
  await userEvent.type(screen.getByLabelText('名称'), '研发部');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

test('stays open and shows the error when onSubmit rejects', async () => {
  render(
    <Harness onSubmit={async () => Promise.reject(new Error('编码已存在'))} />,
  );
  await userEvent.type(screen.getByLabelText('名称'), '研发部');
  await userEvent.click(screen.getByRole('button', { name: '保存' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('编码已存在');
  expect(screen.getByRole('dialog', { name: '新建部门' })).toBeVisible();
});
