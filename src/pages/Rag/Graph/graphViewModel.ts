export type GraphSelection =
  | { kind: 'node'; value: RagAPI.KnowledgeGraphNodeVO }
  | { kind: 'edge'; value: RagAPI.KnowledgeGraphEdgeVO };

/** 只列当前响应中的关系，不推定全库度数，也不请求邻居扩展。 */
export function currentGraphRelations(
  graph: Pick<RagAPI.KnowledgeGraphVO, 'nodes' | 'edges'> | undefined,
  nodeId: string,
) {
  if (!graph?.nodes.some((node) => node.id === nodeId)) return [];
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return graph.edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => ({
      edge,
      node: nodes.get(edge.source === nodeId ? edge.target : edge.source),
    }));
}
