import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DescriptionList,
  EmptyState,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  cn,
} from '@admin-web/ui';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '../../components/CopyButton.tsx';
import { Notice } from '../../components/Notice.tsx';
import { createChunkPageCache } from '../../lib/chunkPagination.ts';
import { readSourceDetails } from '../../lib/sourceDetails.ts';
import { listRagDocumentChunks } from '../../services/rag.ts';
import type { DocumentChunkPageVO, DocumentVO } from '../../services/types.ts';

export type ChunkDocument = Pick<
  DocumentVO,
  'documentId' | 'title' | 'sourceName'
> &
  Partial<
    Pick<DocumentVO, 'documentVersion' | 'documentCode' | 'fileFingerprint'>
  >;

/**
 * 文档切片（照 1.2.4 的 DocumentChunksDrawer）：按后端游标顺序翻页，已读页缓存可来回看；
 * 换文档后旧请求作废；读失败时保留已读内容并可重试。container 用于在原生全屏的图谱面板里打开。
 */
export function DocumentChunksSheet({
  document,
  onClose,
  container,
}: {
  document: ChunkDocument;
  onClose: () => void;
  container?: HTMLElement | null;
}) {
  const { t } = useTranslation('rag');
  const cache = useRef(createChunkPageCache(document.documentId));
  const request = useRef<AbortController>(undefined);
  const retryCursor = useRef<string>(undefined);
  const [page, setPage] = useState<DocumentChunkPageVO>();
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // 换了文档（父组件没按文档设 key 时）：在渲染期回到第一页的初始状态。
  const [shownDocumentId, setShownDocumentId] = useState(document.documentId);
  if (shownDocumentId !== document.documentId) {
    setShownDocumentId(document.documentId);
    setPage(undefined);
    setSelectedId(undefined);
    setPageNumber(1);
    setLoading(true);
    setError(false);
  }
  const selected =
    page?.items.find((item) => item.chunkId === selectedId) ?? page?.items[0];
  const source = selected ? readSourceDetails(selected, t) : undefined;

  const displayCachedPage = () => {
    const current = cache.current.current();
    setPage(current);
    setPageNumber(cache.current.pageNumber());
    setSelectedId(current?.items[0]?.chunkId);
    setError(false);
  };
  const load = (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    retryCursor.current = cursor;
    const pending = cache.current.begin(cursor);
    return listRagDocumentChunks(
      document.documentId,
      { limit: 20, cursor },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        if (!response) throw new Error('Missing chunk page');
        if (cache.current.accept(pending, response)) displayCachedPage();
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  };
  const loadFrom = (cursor?: string) => {
    setLoading(true);
    setError(false);
    void load(cursor);
  };
  const loadFirstPage = useEffectEvent(() => load());
  useEffect(() => {
    const chunkCache = cache.current;
    chunkCache.reset(document.documentId);
    void loadFirstPage();
    return () => {
      request.current?.abort();
      chunkCache.reset();
    };
  }, [document.documentId]);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        container={container}
        className="w-full overflow-y-auto sm:max-w-5xl"
      >
        <SheetHeader>
          <SheetTitle className="break-all">
            {document.title || t('chunks.title')}
          </SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all">
                {document.sourceName || t('chunks.sourceMissing')}
              </span>
              {document.documentVersion !== undefined ? (
                <Badge variant="secondary">
                  {t('upload.versionValue', {
                    version: document.documentVersion,
                  })}
                </Badge>
              ) : null}
              {document.documentCode ? (
                <span>{document.documentCode}</span>
              ) : null}
            </div>
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <nav
            aria-label={t('chunks.pagination')}
            className="flex items-center justify-end gap-2"
          >
            <Button
              variant="outline"
              size="icon"
              aria-label={t('chunks.previous')}
              disabled={loading || pageNumber <= 1}
              onClick={() => {
                if (cache.current.previous()) displayCachedPage();
              }}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="text-sm">
              {t('chunks.page', { page: pageNumber })}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('chunks.next')}
              disabled={loading || !page?.nextCursor}
              onClick={() => {
                if (cache.current.nextCached()) displayCachedPage();
                else if (page?.nextCursor) loadFrom(page.nextCursor);
              }}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
          {error ? (
            <Notice
              tone="error"
              title={t('chunks.failed')}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadFrom(retryCursor.current)}
                >
                  {t('chunks.retry')}
                </Button>
              }
            />
          ) : null}
          {page?.items.length ? (
            <div
              aria-busy={loading}
              className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]"
            >
              <aside
                aria-label={t('chunks.directory')}
                className="flex flex-col gap-2"
              >
                <span className="text-sm text-muted-foreground">
                  {t('chunks.count', { count: page.items.length })}
                </span>
                <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
                  {page.items.map((item) => {
                    const active = selected?.chunkId === item.chunkId;
                    return (
                      <li key={item.chunkId}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelectedId(item.chunkId)}
                          className={cn(
                            'flex w-full flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                            active && 'border-primary bg-accent',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <strong>
                              {t('chunks.chunk', {
                                index: item.chunkIndex + 1,
                              })}
                            </strong>
                            <Badge variant="outline">{item.chunkType}</Badge>
                          </span>
                          <span className="line-clamp-2 text-muted-foreground break-all">
                            {item.content}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>
              {selected && source ? (
                <article
                  aria-label={t('chunks.content')}
                  className="flex min-w-0 flex-col gap-3"
                >
                  <div>
                    <h3 className="font-semibold">
                      {t('chunks.chunk', { index: selected.chunkIndex + 1 })}
                    </h3>
                    <span className="text-sm text-muted-foreground break-all">
                      {selected.sourceLocator ||
                        source.sectionPath ||
                        t('chunks.locationMissing')}
                    </span>
                  </div>
                  <div className="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
                    {selected.content}
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="group -ml-2">
                        {t('chunks.metadata')}
                        <ChevronDown
                          aria-hidden="true"
                          className="transition-transform group-data-[state=open]:rotate-180"
                        />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <DescriptionList
                        items={[
                          {
                            label: t('chunks.source'),
                            value: (
                              <span className="break-all">
                                {source.sourceName ||
                                  document.sourceName ||
                                  t('notProvided')}
                              </span>
                            ),
                          },
                          {
                            label: t('graph.sources.location'),
                            value: (
                              <span className="break-all">
                                {selected.sourceLocator || t('notProvided')}
                              </span>
                            ),
                          },
                          {
                            label: t('chunks.section'),
                            value: source.sectionPath || t('notProvided'),
                          },
                          {
                            label: t('graph.sources.chunkId'),
                            value: (
                              <span className="flex items-center gap-1 break-all">
                                <code className="font-mono text-xs">
                                  {selected.chunkId}
                                </code>
                                <CopyButton
                                  value={selected.chunkId}
                                  label={t('retrieval.source.copyChunkId')}
                                />
                              </span>
                            ),
                          },
                          ...source.metadata.map((detail) => ({
                            label: detail.label,
                            value: detail.value,
                          })),
                          ...(selected.duplicateLocators?.length
                            ? [
                                {
                                  label: t('chunks.duplicates'),
                                  value: selected.duplicateLocators.join(
                                    t('chunks.duplicateSeparator'),
                                  ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </article>
              ) : null}
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <EmptyState
              title={error ? t('chunks.unavailable') : t('chunks.empty')}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
