import type { DocumentChunkPageVO } from '../services/types.ts';

type PageRequest = { generation: number; documentId: string; cursor?: string };

/**
 * 切片分页（照 1.2.4 的 chunkPagination.ts）：只缓存按顺序读到的游标页，不用前端页码编造后端的分页位置；
 * 换文档或有更新的请求后，旧请求的结果不再接纳。
 */
export function createChunkPageCache(initialDocumentId: string) {
  let documentId = initialDocumentId;
  let generation = 0;
  let accepted = -1;
  let index = 0;
  let pages: { cursor?: string; page: DocumentChunkPageVO }[] = [];
  return {
    begin(cursor?: string): PageRequest {
      return { generation: ++generation, documentId, cursor };
    },
    accept(request: PageRequest, page: DocumentChunkPageVO): boolean {
      if (
        request.generation !== generation ||
        request.documentId !== documentId ||
        accepted === generation
      )
        return false;
      if (
        page.documentId !== documentId ||
        !Array.isArray(page.items) ||
        (page.nextCursor != null && typeof page.nextCursor !== 'string') ||
        (page.nextCursor &&
          (page.nextCursor === request.cursor ||
            pages.some((item) => item.cursor === page.nextCursor)))
      )
        throw new Error('Invalid chunk page');
      if (
        request.cursor &&
        !pages.some((item) => item.page.nextCursor === request.cursor)
      )
        throw new Error('Unknown chunk cursor');
      if (!request.cursor) pages = [];
      pages.push({ cursor: request.cursor, page });
      index = pages.length - 1;
      accepted = generation;
      return true;
    },
    current: () => pages[index]?.page,
    pageNumber: () => index + 1,
    previous() {
      if (!index) return false;
      --index;
      return true;
    },
    nextCached() {
      if (index >= pages.length - 1) return false;
      ++index;
      return true;
    },
    reset(nextDocumentId = documentId) {
      documentId = nextDocumentId;
      ++generation;
      pages = [];
      index = 0;
      accepted = -1;
    },
  };
}
