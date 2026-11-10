export type DocumentFilters = {
  search?: string;
  knowledgeBase?: string;
  status?: string;
  sourceType?: string;
  sort?: 'newest' | 'oldest';
};

export function filterDocuments(
  documents: RagAPI.DocumentVO[],
  filters: DocumentFilters,
): RagAPI.DocumentVO[] {
  const search = filters.search?.trim().toLowerCase() || '';
  return documents
    .filter((document) => {
      const type = document.sourceType.toLowerCase();
      return (
        (!filters.knowledgeBase ||
          document.knowledgeBase === filters.knowledgeBase) &&
        (!filters.status || document.status === filters.status) &&
        (!filters.sourceType ||
          (filters.sourceType === 'image'
            ? ['png', 'jpg', 'jpeg'].includes(type)
            : type === filters.sourceType)) &&
        (!search ||
          [document.title, document.sourceName, document.documentCode].some(
            (value) => value.toLowerCase().includes(search),
          ))
      );
    })
    .sort((left, right) => {
      const time = (value: string) => Date.parse(value) || 0;
      const difference = time(right.ingestedAt) - time(left.ingestedAt);
      return (
        (filters.sort === 'oldest' ? -difference : difference) ||
        left.documentId.localeCompare(right.documentId)
      );
    });
}

export function retrievalState(value?: RagAPI.RetrievalVO) {
  if (!value) return 'idle';
  if (value.enabled === false) return 'disabled';
  if (value.enabled !== true) return 'unavailable';
  if (value.matched && value.chunks?.length) return 'matched';
  if (
    !value.matched &&
    !value.chunks?.length &&
    value.message === 'no knowledge matched'
  ) {
    return 'empty';
  }
  return 'unavailable';
}

/** 作用域还未发起下一请求时，也不能接纳上一身份或知识库的迟到结果。 */
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
