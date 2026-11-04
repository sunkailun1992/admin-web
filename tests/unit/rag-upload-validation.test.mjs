import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const compiled = ts.transpileModule(
  readFileSync(
    new URL(
      '../../src/pages/Rag/Document/uploadValidation.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
runInContext(compiled, createContext({ exports: module.exports }));
const { validateRagUpload } = module.exports;

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
    assert.equal(
      validateRagUpload({ name, type, size: 1024 }),
      undefined,
      name,
    );
  }
});

test('allows exactly 20 MiB but rejects one byte more', () => {
  const file = {
    name: 'manual.pdf',
    type: 'application/pdf',
    size: 20 * 1024 * 1024,
  };
  assert.equal(validateRagUpload(file), undefined);
  assert.equal(
    validateRagUpload({ ...file, size: file.size + 1 }),
    '单文件不能超过 20 MB',
  );
});

test('rejects an empty file before an upload request can be created', () => {
  assert.equal(
    validateRagUpload({ name: 'empty.pdf', type: 'application/pdf', size: 0 }),
    '文件为空或大小无效，请重新选择',
  );
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
    assert.equal(
      validateRagUpload({ name, type: '', size: 1024 }),
      '仅支持 XLSX、DOCX、PDF、PNG 和 JPG/JPEG 文件',
    );
  }
});

test('rejects inconsistent reported content types without reading file contents', () => {
  for (const type of ['text/html', 'image/svg+xml', 'application/javascript']) {
    assert.equal(
      validateRagUpload({ name: 'manual.pdf', type, size: 1024 }),
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
    assert.equal(validateRagUpload({ name, type, size: 1024 }), undefined);
  }
  assert.equal(
    validateRagUpload({
      name: 'manual.pdf',
      type: 'application/zip',
      size: 1024,
    }),
    '文件类型与扩展名不一致，请检查文件格式',
  );
});

test('rejects path components and control characters in filenames', () => {
  for (const name of [
    '../manual.pdf',
    '..\\manual.pdf',
    'scan\u0000.png',
    'scan\n.png',
    '',
  ]) {
    assert.equal(
      validateRagUpload({ name, type: '', size: 1024 }),
      '文件名不合法，请使用不含路径的文件名',
    );
  }
});
