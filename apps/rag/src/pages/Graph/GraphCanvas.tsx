import { Button, EmptyState } from '@admin-web/ui';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import {
  Crosshair,
  Eraser,
  Maximize,
  Minimize,
  Scan,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  createGraphFullscreen,
  type GraphFullscreen,
} from '../../lib/graphFullscreen.ts';
import { nodePresentation } from '../../lib/graphModel.ts';
import type { GraphSelection } from '../../lib/graphViewModel.ts';
import {
  createGraphViewport,
  type GraphViewport,
  type GraphViewportAdapter,
} from '../../lib/graphViewport.ts';
import type { KnowledgeGraphVO } from '../../services/types.ts';

export type GraphCanvasHandle = { focusNode: (id: string) => void };

const MIN_ZOOM = 0.01;
// 少量节点自动适配时也受上限约束，避免单个节点与标签被放大到铺满画布（照 1.2.4）。
const MAX_ZOOM = 1.5;
const LABEL_LIMIT = 16;
const SELECTED = '#52c41a';

const label = (value: unknown) => {
  const name = String(value ?? '');
  return name.length > LABEL_LIMIT ? `${name.slice(0, LABEL_LIMIT)}…` : name;
};

/** 节点与关系转成 Cytoscape 元素；样式数据（颜色、直径、标签）随元素带上。 */
function elements(graph: KnowledgeGraphVO): ElementDefinition[] {
  const ids = new Set(graph.nodes.map((node) => node.id));
  return [
    ...graph.nodes.map((node) => {
      const presentation = nodePresentation(node.type);
      return {
        group: 'nodes' as const,
        data: {
          id: node.id,
          label: label(node.name),
          color: presentation.color,
          size: presentation.size,
        },
      };
    }),
    // 端点不在当前结果里的关系画不出来，略过（详情里仍按当前结果列出）。
    ...graph.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({
        group: 'edges' as const,
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: label(edge.label || edge.type),
        },
      })),
  ];
}

const STYLE: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      width: 'data(size)',
      height: 'data(size)',
      'background-color': 'data(color)',
      'border-color': '#ffffff',
      'border-width': 2,
      label: 'data(label)',
      'font-size': 11,
      color: '#1f2937',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-max-width': '132px',
      'text-wrap': 'ellipsis',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.9,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.2,
      'line-color': '#c9cdd4',
      'target-arrow-color': '#c9cdd4',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.8,
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': 10,
      color: '#4b5563',
      'text-max-width': '120px',
      'text-wrap': 'ellipsis',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.9,
      'text-background-padding': '1px',
    },
  },
  {
    selector: 'node:selected',
    style: { 'border-width': 4, 'border-color': SELECTED },
  },
  {
    selector: 'edge:selected',
    style: { 'line-color': SELECTED, 'target-arrow-color': SELECTED, width: 3 },
  },
];

/** Cytoscape 实例接到与画布库无关的视口控制上（缩放比例、适配、定位、尺寸、销毁）。 */
function cytoscapeAdapter(cy: Core): GraphViewportAdapter {
  return {
    getZoom: () => cy.zoom(),
    zoomBy: (ratio) => {
      cy.zoom({
        level: cy.zoom() * ratio,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
    },
    fitView: () => {
      cy.fit(undefined, 24);
    },
    focusElement: (id) => {
      const element = cy.getElementById(id);
      if (element.nonempty()) cy.center(element);
    },
    resize: () => cy.resize(),
    destroy: () => cy.destroy(),
  };
}

/**
 * 知识图谱画布（照 1.2.4 的 GraphCanvas，画布库换成 Cytoscape.js，布局用内置的 cose 力导向）：
 * 只持有画布、视口与全屏的生命周期；查询与构建不进这个组件。画布本身读屏软件读不到，另给一句节点与关系数的文字说明。
 */
export const GraphCanvas = forwardRef<
  GraphCanvasHandle,
  {
    graph?: KnowledgeGraphVO;
    selection?: GraphSelection;
    onSelect: (selection?: GraphSelection) => void;
    fullscreenTarget: RefObject<HTMLDivElement | null>;
    onFullscreenChange: (active: boolean) => void;
  }
>(function GraphCanvas(
  { graph: data, selection, onSelect, fullscreenTarget, onFullscreenChange },
  ref,
) {
  const { t } = useTranslation('rag');
  const summaryId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core>(undefined);
  const viewportRef = useRef<GraphViewport>(undefined);
  const fullscreenRef = useRef<GraphFullscreen>(undefined);
  const selectRef = useRef(onSelect);
  const fullscreenCallback = useRef(onFullscreenChange);
  useEffect(() => {
    selectRef.current = onSelect;
    fullscreenCallback.current = onFullscreenChange;
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rendered, setRendered] = useState({ nodes: 0, edges: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);

  const act = (
    action: (viewport: GraphViewport) => Promise<unknown> | void,
  ) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    Promise.resolve()
      .then(() => action(viewport))
      .catch(() => {
        if (viewportRef.current === viewport)
          toast.error(t('graph.canvas.actionFailed'));
      });
  };

  useImperativeHandle(ref, () => ({
    focusNode(id) {
      const node = data?.nodes.find((value) => value.id === id);
      if (!node) return;
      act(async (viewport) => {
        if (await viewport.focus(id))
          selectRef.current({ kind: 'node', value: node });
      });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    setReady(false);
    setFailed(false);
    setRendered({ nodes: 0, edges: 0 });
    if (!container || !data?.nodes.length) return undefined;
    const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(data.edges.map((edge) => [edge.id, edge]));
    let cy: Core;
    try {
      cy = cytoscape({
        container,
        elements: elements(data),
        style: STYLE,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        boxSelectionEnabled: false,
        selectionType: 'single',
        layout: { name: 'cose', animate: false, fit: true, padding: 24 },
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    cyRef.current = cy;
    const viewport = createGraphViewport(cytoscapeAdapter(cy), [
      ...nodesById.keys(),
      ...edgesById.keys(),
    ]);
    viewportRef.current = viewport;
    cy.on('tap', 'node', (event) => {
      const node = nodesById.get(event.target.id());
      selectRef.current(node ? { kind: 'node', value: node } : undefined);
    });
    cy.on('tap', 'edge', (event) => {
      const edge = edgesById.get(event.target.id());
      selectRef.current(edge ? { kind: 'edge', value: edge } : undefined);
    });
    cy.on('zoom', () => {
      if (cyRef.current === cy) setZoom(viewport.zoomPercent());
    });
    // 容器尺寸变化（含全屏）由 Cytoscape 自己的 ResizeObserver 处理（3.x 起内置），这里不再重复监听。
    // 布局不带动画，构造时已同步完成：此时视口可用。
    viewport.activate();
    viewport.resize(container.clientWidth, container.clientHeight);
    setRendered({ nodes: cy.nodes().length, edges: cy.edges().length });
    setZoom(viewport.zoomPercent());
    setReady(true);
    return () => {
      if (viewportRef.current === viewport) viewportRef.current = undefined;
      if (cyRef.current === cy) cyRef.current = undefined;
      viewport.dispose();
    };
  }, [data]);

  // 选中状态跟着页面的选择走（点画布、点详情里的名称、定位下拉都会改它）。
  const selectedId = selection?.value.id;
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements(':selected').unselect();
    if (selectedId) cy.getElementById(selectedId).select();
  }, [selectedId, ready]);

  useEffect(() => {
    const target = fullscreenTarget.current;
    setFullscreenAvailable(Boolean(target));
    if (!target) return undefined;
    const controller = createGraphFullscreen(target, document, (active) => {
      setFullscreen(active);
      fullscreenCallback.current(active);
    });
    fullscreenRef.current = controller;
    return () => {
      if (fullscreenRef.current === controller)
        fullscreenRef.current = undefined;
      controller.dispose();
    };
  }, [fullscreenTarget]);

  const toggleFullscreen = () => {
    const controller = fullscreenRef.current;
    controller?.toggle().catch(() => {
      if (fullscreenRef.current === controller)
        toast.error(t('graph.canvas.exitFailed'));
    });
  };

  const control = (props: {
    label: string;
    hint: string;
    disabled: boolean;
    onClick: () => void;
    icon: ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="icon"
      aria-label={props.label}
      title={props.hint}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.icon}
    </Button>
  );

  const empty = !data?.nodes.length || failed;
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        role="img"
        aria-label={t('graph.canvas.label')}
        aria-describedby={empty ? undefined : summaryId}
        data-testid="graph-canvas"
        className="h-full min-h-[24rem] w-full flex-1 bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <p id={summaryId} className="sr-only" aria-live="polite">
        {ready ? t('graph.canvas.summary', rendered) : ''}
      </p>
      {empty ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState
            title={failed ? t('graph.canvas.failed') : t('graph.canvas.empty')}
          />
        </div>
      ) : null}
      <div
        role="toolbar"
        aria-label={t('graph.canvas.controls')}
        className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-sm"
      >
        {control({
          label: t('graph.canvas.zoomOut'),
          hint: t('graph.canvas.zoomOutHint'),
          disabled: !ready,
          onClick: () => act((viewport) => viewport.zoom(1 / 1.2)),
          icon: <ZoomOut aria-hidden="true" />,
        })}
        <span
          aria-live="polite"
          className="w-12 text-center text-xs tabular-nums"
        >
          {zoom}%
        </span>
        {control({
          label: t('graph.canvas.zoomIn'),
          hint: t('graph.canvas.zoomInHint'),
          disabled: !ready,
          onClick: () => act((viewport) => viewport.zoom(1.2)),
          icon: <ZoomIn aria-hidden="true" />,
        })}
        {control({
          label: t('graph.canvas.fit'),
          hint: t('graph.canvas.fitHint'),
          disabled: !ready,
          onClick: () => act((viewport) => viewport.fit()),
          icon: <Scan aria-hidden="true" />,
        })}
        {control({
          label: t('graph.canvas.focus'),
          hint: t('graph.canvas.focusHint'),
          disabled: !ready || !selectedId,
          onClick: () => act((viewport) => viewport.focus(selectedId)),
          icon: <Crosshair aria-hidden="true" />,
        })}
        {control({
          label: t('graph.canvas.clear'),
          hint: t('graph.canvas.clearHint'),
          disabled: !selection,
          onClick: () => selectRef.current(undefined),
          icon: <Eraser aria-hidden="true" />,
        })}
        {control({
          label: fullscreen
            ? t('graph.canvas.exitFullscreen')
            : t('graph.canvas.fullscreen'),
          hint: fullscreen
            ? t('graph.canvas.exitFullscreenHint')
            : t('graph.canvas.fullscreenHint'),
          disabled: !fullscreenAvailable,
          onClick: toggleFullscreen,
          icon: fullscreen ? (
            <Minimize aria-hidden="true" />
          ) : (
            <Maximize aria-hidden="true" />
          ),
        })}
      </div>
    </div>
  );
});
