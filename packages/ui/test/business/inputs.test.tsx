import {
  Button,
  ConfirmAction,
  GeneratedCodeInput,
  UploadDropzone,
} from '@admin-web/ui';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

test('GeneratedCodeInput fills the value from generate() and disables while generating', async () => {
  let resolve: (code: string) => void = () => {};
  const generate = vi.fn(() => new Promise<string>((r) => (resolve = r)));
  function Harness() {
    const [value, setValue] = useState('');
    return (
      <GeneratedCodeInput
        aria-label="编码"
        value={value}
        onChange={setValue}
        generate={generate}
      />
    );
  }
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '生成' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled(),
  );
  resolve('DEPT_0001');
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: '编码' })).toHaveValue(
      'DEPT_0001',
    ),
  );
  expect(screen.getByRole('button', { name: '生成' })).toBeEnabled();
});

test('UploadDropzone rejects a file failing validate() and shows its message', async () => {
  const onFiles = vi.fn();
  render(
    <UploadDropzone
      accept=".pdf"
      label="选择文档"
      validate={(f) => (f.name.endsWith('.pdf') ? undefined : '只支持 PDF')}
      onFiles={onFiles}
    />,
  );
  const input = screen.getByLabelText('选择文档');
  // 绕过 accept 过滤，让不合规的文件进到 validate。
  await userEvent
    .setup({ applyAccept: false })
    .upload(input, new File(['x'], 'a.txt', { type: 'text/plain' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('只支持 PDF');
  expect(onFiles).not.toHaveBeenCalled();
  await userEvent.upload(
    input,
    new File(['x'], 'b.pdf', { type: 'application/pdf' }),
  );
  expect(onFiles).toHaveBeenCalledTimes(1);
});

test('ConfirmAction calls onConfirm only after confirming', async () => {
  const onConfirm = vi.fn(async () => {});
  render(
    <ConfirmAction title="确认删除" confirmText="删除" onConfirm={onConfirm}>
      <Button>删除部门</Button>
    </ConfirmAction>,
  );
  await userEvent.click(screen.getByRole('button', { name: '删除部门' }));
  expect(onConfirm).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('button', { name: '删除' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
});

test('GeneratedCodeInput recovers when generate() fails', async () => {
  const generate = vi.fn(async () => {
    throw new Error('生成失败');
  });
  const onChange = vi.fn();
  render(
    <GeneratedCodeInput
      aria-label="编码"
      value=""
      onChange={onChange}
      generate={generate}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '生成' }));
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '生成' })).toBeEnabled(),
  );
  expect(onChange).not.toHaveBeenCalled();
});

test('ConfirmAction stays open and usable when onConfirm fails', async () => {
  const onConfirm = vi.fn(async () => {
    throw new Error('删除失败');
  });
  render(
    <ConfirmAction title="确认删除" confirmText="删除" onConfirm={onConfirm}>
      <Button>删除部门</Button>
    </ConfirmAction>,
  );
  await userEvent.click(screen.getByRole('button', { name: '删除部门' }));
  await userEvent.click(await screen.findByRole('button', { name: '删除' }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('alertdialog', { name: '确认删除' })).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '删除' })).toBeEnabled(),
  );
});

// 真实浏览器里拖放事件要带真正的 DataTransfer；fireEvent.drop 会把它复制成空的，所以直接派发原生事件。
function dropFiles(target: Element, files: File[]) {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  act(() => {
    target.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    );
  });
}

test('UploadDropzone applies accept to dropped files', async () => {
  const onFiles = vi.fn();
  render(
    <UploadDropzone
      accept=".pdf,application/pdf"
      label="选择文档"
      onFiles={onFiles}
    />,
  );
  // 拖入不走文件选择框的 accept 过滤，组件自己要按 accept 查。
  dropFiles(screen.getByText('选择文档'), [
    new File(['x'], 'a.docx', { type: 'application/msword' }),
  ]);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '不支持这种文件类型',
  );
  expect(onFiles).not.toHaveBeenCalled();
  dropFiles(screen.getByText('选择文档'), [
    new File(['x'], 'B.PDF', { type: '' }),
  ]);
  expect(onFiles).toHaveBeenCalledTimes(1);
});
