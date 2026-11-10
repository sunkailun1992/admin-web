export const RAG_DOCUMENT_STATUS: Record<
  string,
  { label: string; color: string }
> = {
  STAGING: { label: '写入中', color: 'processing' },
  ACTIVE: { label: '可检索', color: 'success' },
  SUPERSEDED: { label: '旧版本', color: 'default' },
  FAILED: { label: '失败', color: 'error' },
  DELETED: { label: '已停用', color: 'default' },
};

export const RAG_DOCUMENT_FORMATS = [
  { label: 'Word', value: 'docx' },
  { label: 'Excel', value: 'xlsx' },
  { label: 'PDF', value: 'pdf' },
  { label: '图片', value: 'image' },
];
