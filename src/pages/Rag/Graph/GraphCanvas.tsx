import {
  AimOutlined,
  BorderOuterOutlined,
  ClearOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import type { IElementEvent } from '@antv/g6';
import { EdgeEvent, Graph, GraphEvent, NodeEvent } from '@antv/g6';
import { Button, Empty, Space, Tooltip, message } from 'antd';
import type { RefObject } from 'react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { GraphFullscreen } from './graphFullscreen';
import { createGraphFullscreen } from './graphFullscreen';
import { nodePresentation } from './graphModel';
import type { GraphSelection } from './graphViewModel';
import type { GraphViewport } from './graphViewport';
import { createGraphViewport } from './graphViewport';
import styles from './index.less';

export type GraphCanvasHandle = { focusNode: (id: string) => void };
type Props = {
  graph?: RagAPI.KnowledgeGraphVO;
  selection?: GraphSelection;
  onSelect: (selection?: GraphSelection) => void;
  fullscreenTarget: RefObject<HTMLDivElement>;
  onFullscreenChange: (active: boolean) => void;
};

/** 仅持有画布与视口生命周期，页面的查询/构建服务不进入此组件。 */
const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas(
  { graph: data, selection, onSelect, fullscreenTarget, onFullscreenChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph>();
  const viewportRef = useRef<GraphViewport>();
  const fullscreenRef = useRef<GraphFullscreen>();
  const selectedIdRef = useRef<string>();
  const selectRef = useRef(onSelect);
  const fullscreenCallback = useRef(onFullscreenChange);
  selectRef.current = onSelect;
  fullscreenCallback.current = onFullscreenChange;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(100);
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
          message.error('画布操作失败，请重新查询图谱后重试');
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
    setReady(false);
    setFailed(false);
    if (!containerRef.current || !data?.nodes.length) return undefined;
    const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
    const edgesById = new Map(data.edges.map((edge) => [edge.id, edge]));
    const instance = new Graph({
      container: containerRef.current,
      autoFit: 'view',
      // 少量节点的自动适配也受缩放上限约束，避免单节点和标签被放大到铺满画布。
      zoomRange: [0.01, 1.5],
      data: {
        nodes: data.nodes.map((node) => ({ id: node.id, data: node })),
        edges: data.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge,
        })),
      },
      node: {
        type: 'circle',
        style: {
          size: (datum) => nodePresentation(datum.data?.type).size,
          fill: (datum) => nodePresentation(datum.data?.type).color,
          stroke: '#ffffff',
          lineWidth: 2,
          labelText: (datum) => {
            const name = String(datum.data?.name || '');
            return name.length > 16 ? `${name.slice(0, 16)}…` : name;
          },
          labelPlacement: 'bottom',
          labelMaxWidth: 132,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.9)',
          labelBackgroundRadius: 3,
          cursor: 'pointer',
        },
        state: {
          selected: {
            lineWidth: 4,
            stroke: '#52c41a',
          },
        },
      },
      edge: {
        type: 'line',
        style: {
          stroke: '#c9cdd4',
          lineWidth: 1.2,
          endArrow: true,
          endArrowSize: 5,
          labelText: (datum) =>
            String(datum.data?.label || datum.data?.type || ''),
          labelFontSize: 10,
          labelMaxWidth: 120,
          labelBackground: true,
          labelBackgroundFill: 'rgba(255,255,255,0.9)',
        },
        state: { selected: { stroke: '#52c41a', lineWidth: 3 } },
      },
      layout: {
        type: 'd3-force',
        animation: false,
        manyBody: { strength: -260 },
        link: { distance: 110, strength: 0.8 },
        collide: { radius: 34 },
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    });
    graphRef.current = instance;
    const viewport = createGraphViewport(instance, [
      ...nodesById.keys(),
      ...edgesById.keys(),
    ]);
    viewportRef.current = viewport;
    instance.on<IElementEvent>(NodeEvent.CLICK, (event) => {
      const node = nodesById.get(String(event.target.id));
      selectRef.current(node ? { kind: 'node', value: node } : undefined);
    });
    instance.on<IElementEvent>(EdgeEvent.CLICK, (event) => {
      const edge = edgesById.get(String(event.target.id));
      selectRef.current(edge ? { kind: 'edge', value: edge } : undefined);
    });
    instance.on(GraphEvent.AFTER_TRANSFORM, () => {
      if (graphRef.current === instance) setZoom(viewport.zoomPercent());
    });
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        viewport.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(containerRef.current);
    instance
      .render()
      .then(() => {
        if (graphRef.current === instance) {
          viewport.activate();
          if (containerRef.current)
            viewport.resize(
              containerRef.current.clientWidth,
              containerRef.current.clientHeight,
            );
          setReady(true);
          setZoom(viewport.zoomPercent());
        }
      })
      .catch(() => {
        if (graphRef.current === instance) setFailed(true);
      });
    return () => {
      observer.disconnect();
      selectedIdRef.current = undefined;
      if (viewportRef.current === viewport) viewportRef.current = undefined;
      if (graphRef.current === instance) graphRef.current = undefined;
      viewport.dispose();
    };
  }, [data]);

  const selectedId = selection?.value.id;
  useEffect(() => {
    const instance = graphRef.current;
    if (!instance || !ready) return;
    const previous = selectedIdRef.current;
    selectedIdRef.current = selectedId;
    const states: Record<string, string[]> = {};
    if (previous) states[previous] = [];
    if (selectedId) states[selectedId] = ['selected'];
    if (Object.keys(states).length) {
      instance.setElementState(states, false).catch(() => {
        if (graphRef.current === instance) setFailed(true);
      });
    }
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
        message.error('未能退出全屏，请按 Escape 后重试');
    });
  };
  const popupContainer = (trigger: HTMLElement) =>
    fullscreenTarget.current || trigger;

  return (
    <div className={styles.canvasShell}>
      <div
        aria-label="知识图谱画布"
        className={styles.graphCanvas}
        ref={containerRef}
      />
      {(!data?.nodes.length || failed) && (
        <div className={styles.emptyGraph}>
          <Empty
            description={
              failed
                ? '画布未能显示，请重新查询图谱'
                : '当前结果没有节点，请调整搜索条件或知识库'
            }
          />
        </div>
      )}
      <div
        aria-label="图谱视图控制"
        className={styles.canvasControls}
        role="toolbar"
      >
        <Space size={2} wrap>
          <Tooltip title="缩小" getPopupContainer={popupContainer}>
            <Button
              aria-label="缩小图谱"
              disabled={!ready}
              icon={<ZoomOutOutlined />}
              onClick={() => act((viewport) => viewport.zoom(1 / 1.2))}
            />
          </Tooltip>
          <span aria-live="polite" className={styles.zoomRatio}>
            {zoom}%
          </span>
          <Tooltip title="放大" getPopupContainer={popupContainer}>
            <Button
              aria-label="放大图谱"
              disabled={!ready}
              icon={<ZoomInOutlined />}
              onClick={() => act((viewport) => viewport.zoom(1.2))}
            />
          </Tooltip>
          <Tooltip title="适配当前结果" getPopupContainer={popupContainer}>
            <Button
              aria-label="适配当前图谱"
              disabled={!ready}
              icon={<BorderOuterOutlined />}
              onClick={() => act((viewport) => viewport.fit())}
            />
          </Tooltip>
          <Tooltip
            title="定位所选节点或关系"
            getPopupContainer={popupContainer}
          >
            <Button
              aria-label="定位所选图谱项"
              disabled={!ready || !selectedId}
              icon={<AimOutlined />}
              onClick={() => act((viewport) => viewport.focus(selectedId))}
            />
          </Tooltip>
          <Tooltip title="清除选择" getPopupContainer={popupContainer}>
            <Button
              aria-label="清除图谱选择"
              disabled={!selection}
              icon={<ClearOutlined />}
              onClick={() => selectRef.current(undefined)}
            />
          </Tooltip>
          <Tooltip
            getPopupContainer={popupContainer}
            title={
              fullscreen
                ? '退出全屏（Escape）'
                : '全屏查看；浏览器不允许时在窗口内最大化'
            }
          >
            <Button
              aria-label={fullscreen ? '退出图谱全屏' : '全屏查看图谱'}
              disabled={!fullscreenAvailable}
              icon={
                fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
              }
              onClick={toggleFullscreen}
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  );
});
export default GraphCanvas;
