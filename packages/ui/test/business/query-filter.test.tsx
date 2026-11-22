import { QueryFilter, type QueryFilterField } from '@admin-web/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

const fields: QueryFilterField[] = [
  { name: 'code', label: '租户编码', type: 'text' },
  {
    name: 'state',
    label: '状态',
    type: 'select',
    options: [
      { value: '启用', label: '启用' },
      { value: '禁用', label: '禁用' },
    ],
  },
];

test('QueryFilter submits the filled conditions and leaves empty ones out', async () => {
  const onSearch = vi.fn();
  render(<QueryFilter fields={fields} onSearch={onSearch} />);
  await userEvent.type(
    screen.getByRole('textbox', { name: '租户编码' }),
    ' T1 ',
  );
  await userEvent.click(screen.getByRole('combobox', { name: '状态' }));
  await userEvent.click(await screen.findByRole('option', { name: '禁用' }));
  // 下拉关闭后，Radix 在下一帧才撤掉页面其余部分的 aria-hidden。
  await userEvent.click(await screen.findByRole('button', { name: '查询' }));
  expect(onSearch).toHaveBeenLastCalledWith({ code: 'T1', state: '禁用' });
  await userEvent.clear(
    await screen.findByRole('textbox', { name: '租户编码' }),
  );
  await userEvent.click(screen.getByRole('combobox', { name: '状态' }));
  await userEvent.click(await screen.findByRole('option', { name: '全部' }));
  await userEvent.click(await screen.findByRole('button', { name: '查询' }));
  expect(onSearch).toHaveBeenLastCalledWith({});
});

test('QueryFilter reset clears the fields and searches again without conditions', async () => {
  const onSearch = vi.fn();
  render(
    <QueryFilter
      fields={fields}
      defaultValues={{ code: 'T9' }}
      onSearch={onSearch}
    />,
  );
  expect(screen.getByRole('textbox', { name: '租户编码' })).toHaveValue('T9');
  await userEvent.click(screen.getByRole('button', { name: '重置' }));
  expect(screen.getByRole('textbox', { name: '租户编码' })).toHaveValue('');
  expect(onSearch).toHaveBeenLastCalledWith({});
});

test('pressing Enter in a text field searches', async () => {
  const onSearch = vi.fn();
  render(<QueryFilter fields={fields} onSearch={onSearch} />);
  await userEvent.type(
    screen.getByRole('textbox', { name: '租户编码' }),
    'T2{Enter}',
  );
  expect(onSearch).toHaveBeenLastCalledWith({ code: 'T2' });
});
