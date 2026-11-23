import {
  Badge,
  Button,
  DescriptionList,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '../../components/CopyButton.tsx';
import type { DocumentVO, RetrievalChunkVO } from '../../services/types.ts';

export type OpenDocument = (
  document: Pick<DocumentVO, 'documentId' | 'title' | 'sourceName'>,
) => void;

type SourceProps = {
  chunk: RetrievalChunkVO;
  canViewDocument: boolean;
  onOpenDocument: OpenDocument;
};

/** 检索命中的来源（照 1.2.4 的 RetrievalSourceContent）：位置、评分、切片编号与命中内容；内容按文本显示。 */
export function RetrievalSourceContent({
  chunk,
  canViewDocument,
  onOpenDocument,
}: SourceProps) {
  const { t } = useTranslation('rag');
  return (
    <div className="rag:flex rag:flex-col rag:gap-5">
      <DescriptionList
        items={[
          {
            label: t('retrieval.source.location'),
            value: (
              <span className="rag:break-all">
                {chunk.source || t('notProvided')}
              </span>
            ),
          },
          {
            label: t('retrieval.source.score'),
            value: (
              <Badge variant="secondary">
                {Number.isFinite(chunk.score)
                  ? chunk.score.toFixed(4)
                  : t('notProvided')}
              </Badge>
            ),
          },
          {
            label: t('retrieval.source.chunkId'),
            value: (
              <span className="rag:flex rag:items-center rag:gap-1 rag:break-all">
                <code className="rag:font-mono rag:text-xs">
                  {chunk.chunkId}
                </code>
                <CopyButton
                  value={chunk.chunkId}
                  label={t('retrieval.source.copyChunkId')}
                />
              </span>
            ),
          },
        ]}
      />
      <section className="rag:flex rag:flex-col rag:gap-2">
        <h3 className="rag:font-semibold">{t('retrieval.source.content')}</h3>
        <div className="rag:max-h-[50vh] rag:overflow-auto rag:rounded-md rag:border rag:bg-muted/40 rag:p-3 rag:text-sm rag:whitespace-pre-wrap rag:break-words">
          {chunk.content}
        </div>
      </section>
      {canViewDocument && chunk.documentId ? (
        <div>
          <Button
            variant="outline"
            onClick={() =>
              onOpenDocument({
                documentId: chunk.documentId,
                title: chunk.title || t('documentFallback'),
                sourceName: chunk.source?.split(' / ')[0] || '',
              })
            }
          >
            {t('viewChunks')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RetrievalSourceSheet({
  onClose,
  ...props
}: SourceProps & { onClose: () => void }) {
  const { t } = useTranslation('rag');
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="rag:overflow-y-auto rag:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="rag:break-all">
            {props.chunk.title || t('retrieval.source.fallbackTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('retrieval.source.description')}
          </SheetDescription>
        </SheetHeader>
        <div className="rag:px-4 rag:pb-6">
          <RetrievalSourceContent {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
