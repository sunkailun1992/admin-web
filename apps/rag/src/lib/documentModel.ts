import type { DocumentVO, RetrievalVO } from '../services/types.ts';

// 文档页的纯逻辑（照 1.2.4 的 documentModel.ts）：筛选排序、检索结果状态、按身份范围作废过期请求。

export type DocumentFilters = {
  search?: string;
  knowledgeBase?: string;
  status?: string;
  sourceType?: string;
  sort?: 'newest' | 'oldest';
};

const IMAGE_TYPES = ['png', 'jpg', 'jpeg'];

/** 按标题、来源、编码搜索，按知识库、状态、格式精确筛选；按入库时间排序，无效日期排在最后。 */
export function filterDocuments(
  documents: readonly DocumentVO[],
  filters: DocumentFilters,
): DocumentVO[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const time = (value: string) => Date.parse(value) || 0;
  return documents
    .filter((document) => {
      const type = document.sourceType.toLowerCase();
      return (
        (!filters.knowledgeBase ||
          document.knowledgeBase === filters.knowledgeBase) &&
        (!filters.status || document.status === filters.status) &&
        (!filters.sourceType ||
          (filters.sourceType === 'image'
            ? IMAGE_TYPES.includes(type)
            : type === filters.sourceType)) &&
        (!search ||
          [document.title, document.sourceName, document.documentCode].some(
            (value) => value.toLowerCase().includes(search),
          ))
      );
    })
    .sort((left, right) => {
      const difference = time(right.ingestedAt) - time(left.ingestedAt);
      return (
        (filters.sort === 'oldest' ? -difference : difference) ||
        left.documentId.localeCompare(right.documentId)
      );
    });
}

export type RetrievalState =
  'idle' | 'disabled' | 'unavailable' | 'matched' | 'empty';

/** 检索结果：服务停用、暂不可用都不当成“没有命中”。 */
export function retrievalState(value?: RetrievalVO): RetrievalState {
  if (!value) return 'idle';
  if (value.enabled === false) return 'disabled';
  if (value.enabled !== true) return 'unavailable';
  if (value.matched && value.chunks?.length) return 'matched';
  if (
    !value.matched &&
    !value.chunks?.length &&
    value.message === 'no knowledge matched'
  )
    return 'empty';
  return 'unavailable';
}

/** 作用域（身份、知识库）还没发起下一个请求时，也不接纳上一个作用域的迟到结果。 */
export function createDocumentRequestGate() {
  let generation = 0;
  let controller: AbortController | undefined;
  const begin = (scope: string) => {
    controller?.abort();
    controller = new AbortController();
    const current = ++generation;
    const signal = controller.signal;
    return {
      signal,
      isCurrent: (liveScope = scope) =>
        current === generation && !signal.aborted && liveScope === scope,
    };
  };
  return {
    begin,
    async settle<T>(
      scope: string,
      liveScope: () => string,
      action: () => Promise<T>,
    ): Promise<T | undefined> {
      const request = begin(scope);
      const result = await action();
      return request.isCurrent(liveScope()) ? result : undefined;
    },
    cancel() {
      ++generation;
      controller?.abort();
    },
  };
}
