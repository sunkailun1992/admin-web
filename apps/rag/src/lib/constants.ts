import type { StatusTone } from '@admin-web/ui';

// 文档的状态与格式（照 1.2.4 的 src/constants/rag.ts）；文字经 rag:documents.statuses、documents.formats。

export const DOCUMENT_STATUSES: ReadonlyArray<{
  value: 'STAGING' | 'ACTIVE' | 'SUPERSEDED' | 'FAILED' | 'DELETED';
  tone: StatusTone;
}> = [
  { value: 'STAGING', tone: 'warning' },
  { value: 'ACTIVE', tone: 'success' },
  { value: 'SUPERSEDED', tone: 'default' },
  { value: 'FAILED', tone: 'destructive' },
  { value: 'DELETED', tone: 'default' },
];

/** 格式筛选：image 包含 png、jpg、jpeg（见 documentModel.filterDocuments）。 */
export const DOCUMENT_FORMATS = ['docx', 'xlsx', 'pdf', 'image'] as const;
