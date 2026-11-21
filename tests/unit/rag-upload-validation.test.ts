import { validateRagUpload } from '@/pages/Rag/Document/uploadValidation';
import { expect, test } from 'vitest';

test('allows Office formats and the new PDF and image formats', () => {
  for (const [name, type] of [
    [
      'knowledge.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'knowledge.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['manual.PDF', 'application/pdf'],
    ['scan.png', 'image/png'],
    ['scan.jpg', 'image/jpeg'],
    ['scan.jpeg', 'image/jpeg'],
  ]) {
    expect(validateRagUpload({ name, type, size: 1024 }), name).toBe(undefined);
  }
});

test('allows exactly 20 MiB but rejects one byte more', () => {
  const file = {
    name: 'manual.pdf',
    type: 'application/pdf',
    size: 20 * 1024 * 1024,
  };
  expect(validateRagUpload(file)).toBe(undefined);
  expect(validateRagUpload({ ...file, size: file.size + 1 })).toBe(
    '单文件不能超过 20 MB',
  );
});

test('rejects an empty file before an upload request can be created', () => {
  expect(
    validateRagUpload({ name: 'empty.pdf', type: 'application/pdf', size: 0 }),
  ).toBe('文件为空或大小无效，请重新选择');
});

test('rejects unsupported and disguised filenames', () => {
  for (const name of [
    'script.html',
    'document.pdf.exe',
    'document',
    'image.svg',
    'file.constructor',
    'file.__proto__',
  ]) {
    expect(validateRagUpload({ name, type: '', size: 1024 })).toBe(
      '仅支持 XLSX、DOCX、PDF、PNG 和 JPG/JPEG 文件',
    );
  }
});

test('rejects inconsistent reported content types without reading file contents', () => {
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript']) {
    expect(validateRagUpload({ name: 'manual.pdf', type, size: 1024 })).toBe(
      '文件类型与扩展名不一致，请检查文件格式',
    );
  }
});

test('allows unknown browser MIME and Office ZIP MIME for backend signature validation', () => {
  for (const [name, type] of [
    ['manual.pdf', ''],
    ['manual.pdf', 'application/octet-stream'],
    ['knowledge.docx', 'application/zip'],
    ['knowledge.xlsx', 'application/zip'],
  ]) {
    expect(validateRagUpload({ name, type, size: 1024 })).toBe(undefined);
  }
  expect(
    validateRagUpload({
      name: 'manual.pdf',
      type: 'application/zip',
      size: 1024,
    }),
  ).toBe('文件类型与扩展名不一致，请检查文件格式');
});

test('rejects path components and control characters in filenames', () => {
  for (const name of [
    '../manual.pdf',
    '..\\manual.pdf',
    'scan\u0000.png',
    'scan\n.png',
    'scan\u007f.png',
    // C1 控制字符（U+0080–U+009F）同样拒绝，与后端 Character.isISOControl 一致。
    'scan\u0085.png',
    'scan\u009f.png',
    '',
  ]) {
    expect(validateRagUpload({ name, type: '', size: 1024 })).toBe(
      '文件名不合法，请使用不含路径的文件名',
    );
  }
});
