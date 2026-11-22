import i18next from 'i18next';
import { expect, test } from 'vitest';
import { readSourceDetails as read } from '../../src/lib/sourceDetails.ts';

// 照搬 1.2.3 tests/unit/rag-source-details.test.ts；标签与取值文字经 rag 命名空间。
const t = i18next.getFixedT('zh-CN', 'rag');
// 结果按 JSON 形状比较：值为 undefined 的键不算。
const readSourceDetails = (value: unknown) =>
  JSON.parse(JSON.stringify(read(value, t)));

test('maps public PDF source fields and OCR limitations without exposing arbitrary properties', () => {
  expect(
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
  ).toStrictEqual({
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
  });
});

test('keeps legacy Office source fields without inventing page or OCR metadata', () => {
  expect(
    readSourceDetails({
      sourceName: '知识.xlsx',
      sourceType: 'xlsx',
      sectionPath: '工作表1',
    }),
  ).toStrictEqual({
    sourceName: '知识.xlsx',
    sourceType: 'xlsx',
    sectionPath: '工作表1',
    metadata: [],
  });
  for (const value of [undefined, null, [], '旧节点', 1, {}])
    expect(readSourceDetails(value)).toStrictEqual({ metadata: [] });
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
  ])
    expect(
      readSourceDetails({
        sourceName: { name: 'bad' },
        sourceType: ['pdf'],
        chunkId: 2,
        chunkType: false,
        sectionPath: '  ',
        sourceMetadata,
      }),
    ).toStrictEqual({ metadata: [] });
  expect(
    readSourceDetails(Object.create({ sourceName: 'inherited.pdf' })),
  ).toStrictEqual({ metadata: [] });
});

test('rejects invalid page numbers and coordinates independently of valid metadata', () => {
  for (const page of [0, -1, 1.5, Infinity, NaN, 10001])
    expect(
      readSourceDetails({ sourceMetadata: { page } }).metadata,
      String(page),
    ).toStrictEqual([]);
  for (const bbox of [
    [],
    [0, 0, 1],
    [0, 0, 1, 1, 2],
    [0, 0, '1', 1],
    [-1, 0, 1, 1],
    [0, 0, Infinity, 1],
    [2, 0, 1, 1],
    [0, 2, 1, 1],
  ])
    expect(
      readSourceDetails({ sourceMetadata: { page: 1, bbox } }).metadata,
      JSON.stringify(bbox),
    ).toStrictEqual([{ key: 'page', label: '页码', value: '1' }]);
});

test('distinguishes unsupported OCR capabilities from missing or invalid flags', () => {
  expect(
    readSourceDetails({
      sourceMetadata: {
        ocr_capabilities: { textRecognition: false, tableStructure: 'true' },
      },
    }).metadata,
  ).toStrictEqual([
    {
      key: 'ocr_capabilities',
      label: 'OCR 能力',
      value: '文字识别：不支持；表格结构：未提供；版面分析：未提供',
    },
  ]);
  expect(
    readSourceDetails({
      sourceMetadata: { ocr_capabilities: { unknown: true } },
    }).metadata,
  ).toStrictEqual([]);
});

test('English labels use the same structure', () => {
  const en = i18next.getFixedT('en-US', 'rag');
  expect(
    JSON.parse(
      JSON.stringify(
        read(
          {
            sourceMetadata: {
              page: 3,
              ocr_capabilities: { textRecognition: true },
            },
          },
          en,
        ),
      ),
    ).metadata,
  ).toStrictEqual([
    { key: 'page', label: 'Page', value: '3' },
    {
      key: 'ocr_capabilities',
      label: 'OCR capabilities',
      value:
        'Text recognition: supported; Table structure: not provided; Layout analysis: not provided',
    },
  ]);
});
