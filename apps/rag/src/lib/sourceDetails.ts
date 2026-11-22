import type { TFunction } from 'i18next';

// 来源详情（照 1.2.4 的 sourceDetails.ts）：检索来源与图谱节点共用；只展示后端公开的来源字段，
// 旧数据与不合法的元信息保持缺省，不渲染任意 JSON。

export type SourceDetailItem = { key: string; label: string; value: string };

export type SourceDetails = {
  sourceName?: string;
  sourceType?: string;
  chunkId?: string;
  chunkType?: string;
  sectionPath?: string;
  metadata: SourceDetailItem[];
};

/** 只读自身属性（不经原型链），非对象一律当作没有。 */
function ownField(value: unknown, key: string): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.hasOwn(value, key)
  )
    return undefined;
  return (value as Record<string, unknown>)[key];
}

function textField(value: unknown, key: string): string | undefined {
  const field = ownField(value, key);
  return typeof field === 'string' && field.trim() ? field : undefined;
}

const OCR_FLAGS = [
  'textRecognition',
  'tableStructure',
  'layoutAnalysis',
] as const;

export function readSourceDetails(
  value: unknown,
  t: TFunction<'rag'>,
): SourceDetails {
  const result: SourceDetails = { metadata: [] };
  for (const key of [
    'sourceName',
    'sourceType',
    'chunkId',
    'chunkType',
    'sectionPath',
  ] as const) {
    const field = textField(value, key);
    if (field) result[key] = field;
  }
  const metadata = ownField(value, 'sourceMetadata');
  const page = ownField(metadata, 'page');
  if (
    typeof page === 'number' &&
    Number.isInteger(page) &&
    page > 0 &&
    page <= 10000
  )
    result.metadata.push({
      key: 'page',
      label: t('source.page'),
      value: String(page),
    });
  const blockType = textField(metadata, 'block_type');
  if (blockType)
    result.metadata.push({
      key: 'block_type',
      label: t('source.blockType'),
      value: blockType,
    });
  const bbox = ownField(metadata, 'bbox');
  if (
    Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every(
      (coordinate) =>
        typeof coordinate === 'number' &&
        Number.isFinite(coordinate) &&
        coordinate >= 0,
    ) &&
    bbox[2] >= bbox[0] &&
    bbox[3] >= bbox[1]
  )
    result.metadata.push({
      key: 'bbox',
      label: t('source.bbox'),
      value: bbox.join(', '),
    });
  const capabilities = ownField(metadata, 'ocr_capabilities');
  const flags = OCR_FLAGS.map((key) => ({
    key,
    value: ownField(capabilities, key),
  }));
  if (flags.some((flag) => typeof flag.value === 'boolean'))
    result.metadata.push({
      key: 'ocr_capabilities',
      label: t('source.ocr'),
      value: flags
        .map(({ key, value: flag }) =>
          t('source.ocrFlag', {
            label: t(`source.ocrFlags.${key}`),
            value:
              typeof flag === 'boolean'
                ? flag
                  ? t('source.supported')
                  : t('source.unsupported')
                : t('source.notProvided'),
          }),
        )
        .join(t('source.ocrSeparator')),
    });
  return result;
}
