import {
  Badge,
  Button,
  DescriptionList,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@admin-web/ui';
import { useTranslation } from 'react-i18next';
import { nodePresentation } from '../../lib/graphModel.ts';
import {
  currentGraphRelations,
  type GraphSelection,
} from '../../lib/graphViewModel.ts';
import type { KnowledgeGraphVO } from '../../services/types.ts';
import type { OpenDocument } from '../Document/RetrievalSourceSheet.tsx';
import { GraphSources } from './GraphSources.tsx';

/**
 * 选中节点或关系的详情（照 1.2.4 的 GraphDetails）：只用当前查询已返回的节点、关系与来源白名单；
 * 关联数量不是全库度数，点名称定位当前画布里已有的节点。
 */
export function GraphDetails({
  selection,
  graph,
  canViewDocument,
  onFocus,
  onOpenDocument,
}: {
  selection?: GraphSelection;
  graph?: KnowledgeGraphVO;
  canViewDocument: boolean;
  onFocus: (id: string) => void;
  onOpenDocument: OpenDocument;
}) {
  const { t } = useTranslation('rag');
  if (!selection)
    return (
      <div className="rag:flex rag:h-full rag:items-center rag:justify-center">
        <EmptyState title={t('graph.details.empty')} />
      </div>
    );
  const node = selection.kind === 'node' ? selection.value : undefined;
  const edge = selection.kind === 'edge' ? selection.value : undefined;
  const nodeName = (id: string) =>
    graph?.nodes.find((item) => item.id === id)?.name || id;
  const related = node ? currentGraphRelations(graph, node.id) : [];
  const presentation = node ? nodePresentation(node.type) : undefined;
  const endpoint = (id: string) => (
    <Button
      variant="link"
      size="sm"
      className="rag:h-auto rag:p-0 rag:break-all rag:whitespace-normal"
      disabled={!graph?.nodes.some((value) => value.id === id)}
      onClick={() => onFocus(id)}
    >
      {nodeName(id)}
    </Button>
  );
  const kind = node ? t('graph.details.node') : t('graph.details.edge');
  return (
    <section aria-label={kind} className="rag:flex rag:flex-col rag:gap-3">
      <header className="rag:flex rag:flex-col rag:items-start rag:gap-1">
        <span className="rag:text-sm rag:text-muted-foreground">{kind}</span>
        <h3 className="rag:font-semibold rag:break-all">
          {node?.name || edge?.label || edge?.type}
        </h3>
        {presentation ? (
          <Badge
            variant="outline"
            style={{
              borderColor: presentation.color,
              color: presentation.color,
            }}
          >
            {t(`graph.nodeTypes.${presentation.key}`)}
          </Badge>
        ) : null}
      </header>
      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">
            {t('graph.details.sources')}
          </TabsTrigger>
          <TabsTrigger value="attributes">
            {t('graph.details.attributes')}
          </TabsTrigger>
          <TabsTrigger value="relations">
            {node
              ? t('graph.details.relationsCount', { count: related.length })
              : t('graph.details.endpoints')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sources" className="rag:pt-2">
          <GraphSources
            properties={selection.value.properties}
            legacy={node}
            canViewDocument={canViewDocument}
            onOpenDocument={onOpenDocument}
          />
        </TabsContent>
        <TabsContent value="attributes" className="rag:pt-2">
          <DescriptionList
            items={[
              {
                label: t('graph.details.id'),
                value: (
                  <span className="rag:break-all">{selection.value.id}</span>
                ),
              },
              ...(node && presentation
                ? [
                    {
                      label: t('graph.details.name'),
                      value: <span className="rag:break-all">{node.name}</span>,
                    },
                    {
                      label: t('graph.details.type'),
                      value: t(`graph.nodeTypes.${presentation.key}`),
                    },
                    ...(node.label
                      ? [{ label: t('graph.details.label'), value: node.label }]
                      : []),
                    ...(node.documentCode
                      ? [
                          {
                            label: t('graph.sources.code'),
                            value: node.documentCode,
                          },
                        ]
                      : []),
                    ...(node.documentVersion !== undefined
                      ? [
                          {
                            label: t('graph.sources.version'),
                            value: t('graph.sources.versionValue', {
                              version: node.documentVersion,
                            }),
                          },
                        ]
                      : []),
                  ]
                : []),
              ...(edge
                ? [
                    {
                      label: t('graph.details.subject'),
                      value: endpoint(edge.source),
                    },
                    {
                      label: t('graph.details.relation'),
                      value: edge.label || edge.type,
                    },
                    { label: t('graph.details.type'), value: edge.type },
                    {
                      label: t('graph.details.object'),
                      value: endpoint(edge.target),
                    },
                  ]
                : []),
              ...(selection.value.sourceLocator
                ? [
                    {
                      label: t('graph.sources.location'),
                      value: (
                        <span className="rag:break-all">
                          {selection.value.sourceLocator}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </TabsContent>
        <TabsContent
          value="relations"
          className="rag:flex rag:flex-col rag:gap-2 rag:pt-2"
        >
          {node ? (
            <>
              <p className="rag:text-sm rag:text-muted-foreground">
                {t('graph.details.relationsHint')}
              </p>
              {related.length ? (
                <ul className="rag:flex rag:flex-col rag:divide-y rag:rounded-md rag:border">
                  {related.map((item) => (
                    <li
                      key={item.edge.id}
                      className="rag:flex rag:flex-col rag:gap-1 rag:px-3 rag:py-2 rag:text-sm"
                    >
                      <span className="rag:text-muted-foreground rag:break-all">
                        {item.edge.label || item.edge.type}
                      </span>
                      {item.node ? (
                        endpoint(item.node.id)
                      ) : (
                        <span className="rag:text-muted-foreground">
                          {t('graph.details.outsideResult')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t('graph.details.noRelations')} />
              )}
            </>
          ) : edge ? (
            <div className="rag:flex rag:flex-col rag:items-start rag:gap-1">
              {endpoint(edge.source)}
              {endpoint(edge.target)}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}
