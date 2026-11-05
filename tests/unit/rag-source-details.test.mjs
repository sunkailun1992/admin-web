import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

const module = { exports: {} };
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../../src/pages/Rag/sourceDetails.ts', import.meta.url),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
runInContext(compiled, createContext({ exports: module.exports }));
const readSourceDetails = (value) =>
  JSON.parse(JSON.stringify(module.exports.readSourceDetails(value)));

test('maps public PDF source fields and OCR limitations without exposing arbitrary properties', () => {
  assert.deepEqual(
    readSourceDetails({
      sourceName: '扫描件.pdf',
      sourceType: 'pdf',
      chunkId: 'chunk-1',
      chunkType: 'ocr-text',
      sectionPath: '第2页',
      sourceMetadata: {
        page: 2,
        block_type: 'ocr-text',
        bbox: [0, 12.5, 100, 30],
        ocr_capabilities: {
          textRecognition: true,
          tableStructure: false,
          layoutAnalysis: false,
          internalEngine: 'private',
        },
        internalPath: 'private',
      },
      internalPath: 'private',
    }),
    {
      sourceName: '扫描件.pdf',
      sourceType: 'pdf',
      chunkId: 'chunk-1',
      chunkType: 'ocr-text',
      sectionPath: '第2页',
      metadata: [
        { key: 'page', label: '页码', value: '2' },
        { key: 'block_type', label: '区块类型', value: 'ocr-text' },
        { key: 'bbox', label: '区块坐标', value: '0, 12.5, 100, 30' },
        {
          key: 'ocr_capabilities',
          label: 'OCR 能力',
          value: '文字识别：支持；表格结构：不支持；版面分析：不支持',
        },
      ],
    },
  );
});

test('keeps legacy Office source fields without inventing page or OCR metadata', () => {
  assert.deepEqual(
    readSourceDetails({
      sourceName: '知识.xlsx',
      sourceType: 'xlsx',
      sectionPath: '工作表1',
    }),
    {
      sourceName: '知识.xlsx',
      sourceType: 'xlsx',
      sectionPath: '工作表1',
      metadata: [],
    },
  );
  for (const value of [undefined, null, [], '旧节点', 1, {}]) {
    assert.deepEqual(readSourceDetails(value), { metadata: [] });
  }
});

test('ignores malformed, inherited and unknown fields instead of rendering arbitrary JSON', () => {
  for (const sourceMetadata of [
    [],
    'metadata',
    {
      page: '2',
      bbox: '0, 0, 1, 1',
      block_type: { text: 'text' },
      ocr_capabilities: { textRecognition: 'true' },
      unknown: 'private',
    },
    Object.create({ page: 2, block_type: 'inherited' }),
  ]) {
    assert.deepEqual(
      readSourceDetails({
        sourceName: { name: 'bad' },
        sourceType: ['pdf'],
        chunkId: 2,
        chunkType: false,
        sectionPath: '  ',
        sourceMetadata,
      }),
      { metadata: [] },
    );
  }
  assert.deepEqual(
    readSourceDetails(Object.create({ sourceName: 'inherited.pdf' })),
    { metadata: [] },
  );
});

test('rejects invalid page numbers and coordinates independently of valid metadata', () => {
  for (const page of [0, -1, 1.5, Infinity, NaN, 10001]) {
    assert.deepEqual(
      readSourceDetails({ sourceMetadata: { page } }).metadata,
      [],
    );
  }
  for (const bbox of [
    [],
    [0, 0, 1],
    [0, 0, 1, 1, 2],
    [0, 0, '1', 1],
    [-1, 0, 1, 1],
    [0, 0, Infinity, 1],
    [2, 0, 1, 1],
    [0, 2, 1, 1],
  ]) {
    assert.deepEqual(
      readSourceDetails({ sourceMetadata: { page: 1, bbox } }).metadata,
      [{ key: 'page', label: '页码', value: '1' }],
    );
  }
});

test('distinguishes unsupported OCR capabilities from missing or invalid flags', () => {
  assert.deepEqual(
    readSourceDetails({
      sourceMetadata: {
        ocr_capabilities: { textRecognition: false, tableStructure: 'true' },
      },
    }).metadata,
    [
      {
        key: 'ocr_capabilities',
        label: 'OCR 能力',
        value: '文字识别：不支持；表格结构：未提供；版面分析：未提供',
      },
    ],
  );
  assert.deepEqual(
    readSourceDetails({
      sourceMetadata: { ocr_capabilities: { unknown: true } },
    }).metadata,
    [],
  );
});
