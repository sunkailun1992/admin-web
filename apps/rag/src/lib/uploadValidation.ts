// 上传前的前置校验（照 1.2.4 的 uploadValidation.ts）：只减少误上传；
// 真实文件类型、解析权限和资源上限仍由后端检查。

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

/** 不通过的原因（界面经 rag:upload.errors.<键> 显示）。 */
export type UploadError =
  'invalidName' | 'unsupportedType' | 'emptyFile' | 'tooLarge' | 'mimeMismatch';

export function validateRagUpload(
  file: Pick<File, 'name' | 'size' | 'type'>,
): UploadError | undefined {
  // 路径分隔符与控制字符（含 C1，与后端 Character.isISOControl 一致）一律拒绝。
  if (!file.name || /[/\\\p{Cc}]/u.test(file.name)) return 'invalidName';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowedMimeTypes = Object.hasOwn(FORMAT_MIME_TYPES, extension)
    ? FORMAT_MIME_TYPES[extension]
    : undefined;
  if (!allowedMimeTypes || !file.name.includes('.')) return 'unsupportedType';
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return 'emptyFile';
  if (file.size > MAX_FILE_BYTES) return 'tooLarge';
  // 浏览器可能没有 MIME 信息，不能因此拒绝合法文件；后端会核对实际文件头。
  const mimeType = file.type.toLowerCase();
  if (
    mimeType &&
    mimeType !== 'application/octet-stream' &&
    !allowedMimeTypes.includes(mimeType)
  )
    return 'mimeMismatch';
  return undefined;
}
