const MAX_FILE_BYTES = 20 * 1024 * 1024;

const FORMAT_MIME_TYPES: Record<string, readonly string[]> = {
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

export const RAG_UPLOAD_ACCEPT = '.xlsx,.docx,.pdf,.png,.jpg,.jpeg';

/** 前置校验只减少误上传；真实文件类型、解析权限和资源上限仍由后端检查。 */
export function validateRagUpload(
  file: Pick<File, 'name' | 'size' | 'type'>,
): string | undefined {
  if (!file.name || /[/\\\u0000-\u001f\u007f]/.test(file.name)) {
    return '文件名不合法，请使用不含路径的文件名';
  }
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedMimeTypes = Object.prototype.hasOwnProperty.call(
    FORMAT_MIME_TYPES,
    extension,
  )
    ? FORMAT_MIME_TYPES[extension]
    : undefined;
  if (!allowedMimeTypes || !file.name.includes('.')) {
    return '仅支持 XLSX、DOCX、PDF、PNG 和 JPG/JPEG 文件';
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return '文件为空或大小无效，请重新选择';
  }
  if (file.size > MAX_FILE_BYTES) {
    return '单文件不能超过 20 MB';
  }
  // 浏览器可能没有 MIME 信息，不能因此拒绝合法文件；后端会核对实际文件头。
  const mimeType = file.type.toLowerCase();
  if (
    mimeType &&
    mimeType !== 'application/octet-stream' &&
    !allowedMimeTypes.includes(mimeType)
  ) {
    return '文件类型与扩展名不一致，请检查文件格式';
  }
  return undefined;
}
