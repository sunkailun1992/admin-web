import { Button, DescriptionList, EmptyState } from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { readGraphSources } from '../../lib/graphModel.ts';
import type {
  KnowledgeGraphNodeProperties,
  KnowledgeGraphNodeVO,
} from '../../services/types.ts';
import type { OpenDocument } from '../Document/RetrievalSourceSheet.tsx';

/**
 * 图谱节点或关系的来源证据（照 1.2.4 的 GraphSources）：只显示来源白名单字段，最多 8 条，
 * 摘录按文本显示并标明截断与格式归一；有文档权限才给“查看文档切片”。
 */
export function GraphSources({
  properties,
  legacy,
  canViewDocument,
  onOpenDocument,
}: {
  properties?: KnowledgeGraphNodeProperties;
  legacy?: KnowledgeGraphNodeVO;
  canViewDocument: boolean;
  onOpenDocument: OpenDocument;
}) {
  const { t } = useTranslation('rag');
  const sources = readGraphSources(properties, t, legacy);
  if (!sources.items.length)
    return <EmptyState title={t('graph.sources.empty')} />;
  return (
    <div className="rag:flex rag:flex-col rag:gap-3">
      <p className="rag:text-sm">
        {t('graph.sources.summary', {
          shown: sources.items.length,
          count: sources.count,
        })}
      </p>
      {sources.truncated ? (
        <p className="rag:text-sm rag:text-muted-foreground">
          {t('graph.sources.truncated')}
        </p>
      ) : null}
      <ul className="rag:flex rag:flex-col rag:gap-3">
        {sources.items.map((source, index) => (
          <li
            key={`${source.documentId || 'source'}-${source.details.chunkId || index}`}
            className="rag:flex rag:flex-col rag:gap-2 rag:rounded-lg rag:border rag:p-3"
          >
            <DescriptionList
              items={[
                {
                  label: t('graph.sources.file'),
                  value: (
                    <span className="rag:break-all">
                      {source.details.sourceName ||
                        source.documentCode ||
                        t('notProvided')}
                    </span>
                  ),
                },
                {
                  label: t('graph.sources.format'),
                  value: source.details.sourceType || t('notProvided'),
                },
                ...(source.documentCode
                  ? [
                      {
                        label: t('graph.sources.code'),
                        value: source.documentCode,
                      },
                    ]
                  : []),
                ...(source.documentVersion !== undefined
                  ? [
                      {
                        label: t('graph.sources.version'),
                        value: t('graph.sources.versionValue', {
                          version: source.documentVersion,
                        }),
                      },
                    ]
                  : []),
                {
                  label: t('graph.sources.location'),
                  value: (
                    <span className="rag:break-all">
                      {source.sourceLocator || t('notProvided')}
                    </span>
                  ),
                },
                ...(source.details.sectionPath
                  ? [
                      {
                        label: t('graph.sources.section'),
                        value: source.details.sectionPath,
                      },
                    ]
                  : []),
                ...(source.details.chunkId
                  ? [
                      {
                        label: t('graph.sources.chunkId'),
                        value: (
                          <span className="rag:break-all">
                            {source.details.chunkId}
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(source.details.chunkType
                  ? [
                      {
                        label: t('graph.sources.chunkType'),
                        value: source.details.chunkType,
                      },
                    ]
                  : []),
                ...(source.details.metadata.length
                  ? source.details.metadata.map((detail) => ({
                      label: detail.label,
                      value: (
                        <span className="rag:break-all">{detail.value}</span>
                      ),
                    }))
                  : [
                      {
                        label: t('graph.sources.metadata'),
                        value: t('notProvided'),
                      },
                    ]),
              ]}
            />
            {source.evidence ? (
              <div className="rag:rounded-md rag:bg-muted/40 rag:p-2 rag:text-sm">
                <strong>{t('graph.sources.evidence')}</strong>
                {source.evidenceTruncated ? (
                  <span className="rag:text-muted-foreground">
                    {t('graph.sources.evidenceTruncated')}
                  </span>
                ) : null}
                {source.evidenceNormalized ? (
                  <span
                    className="rag:text-muted-foreground"
                    title={t('graph.sources.normalizedHint')}
                  >
                    {t('graph.sources.evidenceNormalized')}
                  </span>
                ) : null}
                <div className="rag:whitespace-pre-wrap rag:break-words">
                  {source.evidence}
                </div>
              </div>
            ) : null}
            {canViewDocument && source.documentId ? (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onOpenDocument({
                      documentId: source.documentId!,
                      title:
                        source.details.sourceName ||
                        source.documentCode ||
                        t('documentFallback'),
                      sourceName: source.details.sourceName || '',
                    })
                  }
                >
                  {t('viewChunks')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
