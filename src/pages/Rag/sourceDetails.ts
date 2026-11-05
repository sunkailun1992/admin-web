type SourceDetailItem = { key: string; label: string; value: string };

type SourceDetails = {
  sourceName?: string;
  sourceType?: string;
  chunkId?: string;
  chunkType?: string;
  sectionPath?: string;
  metadata: SourceDetailItem[];
};

function ownField(value: unknown, key: string): unknown {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.prototype.hasOwnProperty.call(value, key)
  ) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

function textField(value: unknown, key: string): string | undefined {
  const field = ownField(value, key);
  return typeof field === 'string' && field.trim() ? field : undefined;
}

/** 只展示后端公开的来源字段，旧数据和非法元信息保持缺省。 */
export function readSourceDetails(value: unknown): SourceDetails {
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
  ) {
    result.metadata.push({ key: 'page', label: '页码', value: String(page) });
  }
  const blockType = textField(metadata, 'block_type');
  if (blockType) {
    result.metadata.push({
      key: 'block_type',
      label: '区块类型',
      value: blockType,
    });
  }
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
  ) {
    result.metadata.push({
      key: 'bbox',
      label: '区块坐标',
      value: bbox.join(', '),
    });
  }

  const capabilities = ownField(metadata, 'ocr_capabilities');
  const flags = [
    ['textRecognition', '文字识别'],
    ['tableStructure', '表格结构'],
    ['layoutAnalysis', '版面分析'],
  ].map(([key, label]) => ({ label, value: ownField(capabilities, key) }));
  if (flags.some((flag) => typeof flag.value === 'boolean')) {
    result.metadata.push({
      key: 'ocr_capabilities',
      label: 'OCR 能力',
      value: flags
        .map(
          ({ label, value: flag }) =>
            `${label}：${
              typeof flag === 'boolean' ? (flag ? '支持' : '不支持') : '未提供'
            }`,
        )
        .join('；'),
    });
  }
  return result;
}
