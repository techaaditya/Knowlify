import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
// The self-contained "standalone" build bundles vis-data, avoiding the CJS
// `require('vis-data/...')` in the default entry that Rolldown/Vite 8 can't resolve.
import { Network } from 'vis-network/standalone/esm/vis-network';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';
import {
  EDGE_STATUS_COLOR,
  NODE_PALETTE,
  RECOMMENDED_GLOW,
  RECOMMENDED_RING,
  categoryFor,
  hexToRgba,
  recommendNextId,
  type NodeCategory,
  type TopicStat,
} from './graphTheme';

// ─────────────────────────────────────────────────────────────────────────────
// Everything below is presentation only: the same graphData/edges/select
// handlers drive the exact same physics + selection contract as before. Only
// the canvas *rendering* (custom node cards, glow edges, particle flow) is
// new — colors match the app's existing warm-alabaster theme (index.css).
// ─────────────────────────────────────────────────────────────────────────────

const BG = '#FAF9F6'; // --swatch-1

interface NodeMeta {
  displayName: string;
  category: NodeCategory;
  mastery: number;
  isRecommended: boolean;
}

export interface GraphFilterState {
  search: string;
  categories: Set<NodeCategory | 'recommended'>;
}

const ALL_FILTERS: Set<NodeCategory | 'recommended'> = new Set(['mastered', 'learning', 'weak', 'locked', 'recommended']);

export const defaultGraphFilters = (): GraphFilterState => ({ search: '', categories: new Set(ALL_FILTERS) });

interface Props {
  filters?: GraphFilterState;
}

export interface ConceptGraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

const roundedRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const ConceptGraph = forwardRef<ConceptGraphHandle, Props>(({ filters }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const clockRef = useRef(0);
  // Shared by both the native selectNode/deselectNode events (real clicks) and
  // the effect that syncs an externally-set selectedNodeId (e.g. side-panel
  // prerequisite links) — vis's own selectNodes() call does NOT fire
  // selectNode, so without sharing this, edge recoloring only worked for
  // direct canvas clicks.
  const applyEdgeColorsRef = useRef<(nodeId: string | null) => void>(() => {});

  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const studentData = useUserStore((state) => state.studentData);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const activeFilters = filters?.categories ?? ALL_FILTERS;
  const search = (filters?.search ?? '').trim().toLowerCase();

  // Stable per-node visual metadata, recomputed only when the underlying data changes.
  const metaById = useMemo<Record<string, NodeMeta>>(() => {
    if (!graphData) return {};
    const topics = (studentData?.topics ?? {}) as Record<string, TopicStat>;
    const recommendedId = recommendNextId(graphData.nodes, topics);
    const out: Record<string, NodeMeta> = {};
    graphData.nodes.forEach((n) => {
      out[n.id] = {
        displayName: n.display_name,
        category: categoryFor(n, topics),
        mastery: topics[n.id]?.mastery_score ?? 0,
        isRecommended: n.id === recommendedId,
      };
    });
    return out;
  }, [graphData, studentData]);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const visNodes = graphData.nodes.map((node) => ({
      id: node.id,
      label: node.display_name,
      shape: 'custom' as const,
      ctxRenderer: buildNodeRenderer(node.id, metaById, clockRef),
    }));

    // Traffic-light branches: each edge is colored by the mastery status of
    // the prerequisite it comes FROM (red = poor, yellow = average, green =
    // excellent, neutral = locked/not started yet). Coloring by the source
    // rather than the target means a weak concept's own branches read red
    // immediately — the target side is usually still locked and has no grade
    // of its own to show.
    const visEdges = graphData.edges.map((edge, idx) => {
      const sourceCategory = metaById[edge.from]?.category ?? 'locked';
      const statusColor = EDGE_STATUS_COLOR[sourceCategory];
      return {
        id: `edge_${idx}`,
        from: edge.from,
        to: edge.to,
        arrows: { to: { enabled: true, scaleFactor: 0.55, type: 'arrow' } },
        color: {
          color: hexToRgba(statusColor, sourceCategory === 'locked' ? 0.4 : 0.75),
          highlight: statusColor,
          hover: statusColor,
          opacity: 1,
        },
        width: 1.75,
        smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.45 },
        shadow: false,
      };
    });

    const data = { nodes: visNodes, edges: visEdges };

    const options = {
      autoResize: true,
      nodes: { chosen: true },
      edges: { selectionWidth: 1.5, hoverWidth: 1.5 },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        tooltipDelay: 100000, // suppress vis's native tooltip; we render our own
        // Without this, vis renders every edge touching the selected node with
        // its `color.highlight` (uniform purple) instead of our own manual
        // incoming/outgoing recolor below — this keeps our colors authoritative.
        selectConnectedEdges: false,
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -55,
          centralGravity: 0.012,
          springLength: 150,
          springConstant: 0.06,
          damping: 0.45,
          avoidOverlap: 0.65,
        },
        stabilization: { iterations: 140, fit: true },
      },
    };

    const network = new Network(containerRef.current, data as never, options as never);
    networkRef.current = network;
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__kgNetwork = network;

    // Fill the (already view-transformed) canvas each frame with the app's backdrop.
    network.on('beforeDrawing', (ctx) => {
      ctx.save();
      ctx.fillStyle = BG;
      ctx.fillRect(-ctx.canvas.width, -ctx.canvas.height, ctx.canvas.width * 3, ctx.canvas.height * 3);
      drawMeshGlow(ctx, clockRef.current);
      ctx.restore();
    });

    // Decorative glow + traveling particles on top of vis's own edge lines.
    network.on('afterDrawing', (ctx) => {
      drawEdgeFlow(ctx, network, visEdges, selectedNodeId, clockRef.current, metaById);
    });

    const edgesDataset = (network as unknown as { body: { data: { edges: { update: (e: unknown[]) => void } } } }).body
      .data.edges;

    const edgeStatusColor = (edge: { from: string }) => EDGE_STATUS_COLOR[metaById[edge.from]?.category ?? 'locked'];
    const isLockedEdge = (edge: { from: string }) => (metaById[edge.from]?.category ?? 'locked') === 'locked';

    // Every edge keeps its traffic-light mastery color (red/yellow/green) at
    // all times, so the whole map reads at a glance — selecting a node just
    // brightens its connections and dims everything else, it never overrides
    // the underlying status hue.
    const applyEdgeColors = (nodeId: string | null) => {
      if (!nodeId) {
        edgesDataset.update(
          visEdges.map((edge) => ({
            id: edge.id,
            color: { color: hexToRgba(edgeStatusColor(edge), isLockedEdge(edge) ? 0.4 : 0.75) },
            width: 1.75,
          })),
        );
        return;
      }
      const touching = new Set(visEdges.filter((e) => e.to === nodeId || e.from === nodeId).map((e) => e.id));
      edgesDataset.update(
        visEdges.map((edge) => {
          const color = edgeStatusColor(edge);
          if (touching.has(edge.id)) return { id: edge.id, color: { color: hexToRgba(color, 1) }, width: 2.5 };
          return { id: edge.id, color: { color: hexToRgba(color, isLockedEdge(edge) ? 0.15 : 0.22) }, width: 1 };
        }),
      );
    };
    applyEdgeColorsRef.current = applyEdgeColors;

    network.on('selectNode', (params) => {
      if (params.nodes.length === 0) return;
      const nodeId = params.nodes[0];
      setSelectedNodeId(nodeId);
      applyEdgeColors(nodeId);
    });

    network.on('deselectNode', () => {
      setSelectedNodeId(null);
      applyEdgeColors(null);
    });

    network.on('hoverNode', (params) => {
      const meta = metaById[params.node as string];
      if (!meta || !containerRef.current) return;
      const pos = network.getPositions([params.node])[params.node];
      const dom = network.canvasToDOM(pos);
      setTooltip({ x: dom.x, y: dom.y, text: `${meta.displayName} — ${Math.round(meta.mastery)}% mastery` });
    });
    network.on('blurNode', () => setTooltip(null));
    network.on('dragging', () => setTooltip(null));
    network.on('zoom', () => setTooltip(null));

    return () => {
      cancelAnimationFrame(rafRef.current);
      network.destroy();
      networkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, studentData, setSelectedNodeId, metaById]);

  // Continuous redraw for the pulse/particle animation — purely visual.
  useEffect(() => {
    const tick = () => {
      clockRef.current = performance.now();
      networkRef.current?.redraw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Apply search/filter visibility without touching the underlying dataset shape.
  useEffect(() => {
    const network = networkRef.current;
    if (!network || !graphData) return;
    const hiddenIds = new Set<string>();
    const updates = graphData.nodes.map((node) => {
      const meta = metaById[node.id];
      const matchesSearch = !search || meta.displayName.toLowerCase().includes(search);
      const matchesFilter =
        activeFilters.has(meta.category) || (meta.isRecommended && activeFilters.has('recommended'));
      const hidden = !(matchesSearch && matchesFilter);
      if (hidden) hiddenIds.add(node.id);
      return { id: node.id, hidden };
    });
    const net = network as unknown as {
      body: { data: { nodes: { update: (n: unknown[]) => void }; edges: { update: (e: unknown[]) => void } } };
    };
    net.body.data.nodes.update(updates);
    // Hide any edge whose endpoint is now hidden — otherwise it dangles mid-air.
    net.body.data.edges.update(
      graphData.edges.map((edge, idx) => ({
        id: `edge_${idx}`,
        hidden: hiddenIds.has(edge.from) || hiddenIds.has(edge.to),
      })),
    );

    if (search) {
      const firstMatch = graphData.nodes.find((n) => metaById[n.id]?.displayName.toLowerCase().includes(search));
      if (firstMatch) {
        network.focus(firstMatch.id, { scale: 1.15, animation: { duration: 450, easingFunction: 'easeInOutQuad' } });
      }
    }
  }, [search, activeFilters, graphData, metaById]);

  // Focus/zoom to selected node if changed externally (e.g. side-panel links).
  // network.selectNodes() does not fire the selectNode event, so we drive the
  // same edge-recolor logic explicitly here to stay in sync with real clicks.
  useEffect(() => {
    if (networkRef.current && selectedNodeId) {
      networkRef.current.selectNodes([selectedNodeId]);
      networkRef.current.focus(selectedNodeId, { scale: 1.15, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
      applyEdgeColorsRef.current(selectedNodeId);
    }
  }, [selectedNodeId]);

  const zoomBy = (factor: number) => {
    const net = networkRef.current;
    if (!net) return;
    net.moveTo({ scale: net.getScale() * factor, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  };

  const fitView = () => {
    networkRef.current?.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    fit: fitView,
  }));

  return (
    <>
      <div id="kg-network-container" ref={containerRef} />
      {tooltip && (
        <div ref={tooltipRef} className="kg-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </>
  );
});

ConceptGraph.displayName = 'ConceptGraph';

// ── Canvas rendering helpers ─────────────────────────────────────────────────

function buildNodeRenderer(
  nodeId: string,
  metaById: Record<string, NodeMeta>,
  clockRef: React.MutableRefObject<number>,
) {
  return ({
    ctx,
    x,
    y,
    state,
  }: {
    ctx: CanvasRenderingContext2D;
    x: number;
    y: number;
    state: { selected: boolean; hover: boolean };
  }) => {
    const meta = metaById[nodeId];
    const palette = NODE_PALETTE[meta?.category ?? 'learning'];
    const t = clockRef.current / 1000;
    const label = meta?.displayName ?? nodeId;
    const isLocked = meta?.category === 'locked';
    const isRecommended = meta?.isRecommended ?? false;

    ctx.font = '600 13px Inter, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const width = Math.min(230, Math.max(150, textWidth + 74));
    const height = 60;
    const lift = state.hover || state.selected ? 4 : 0;
    const floatY = isRecommended ? Math.sin(t * 1.6) * 3 : 0;
    const drawY = y - lift + floatY;
    const radius = 16;

    const nodeDimensions = { width, height: height + 10 };

    const drawNode = () => {
      ctx.save();
      ctx.globalAlpha = isLocked ? 0.55 : 1;

      // Outer recommendation halo — animated dashed ring.
      if (isRecommended) {
        ctx.save();
        ctx.shadowColor = RECOMMENDED_GLOW;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = RECOMMENDED_RING;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -t * 22;
        roundedRectPath(ctx, x - width / 2 - 7, drawY - height / 2 - 7, width + 14, height + 14, radius + 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Card glow + fill.
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = state.hover || state.selected ? 22 : 10;
      ctx.fillStyle = isLocked ? 'rgba(245, 243, 237, 0.9)' : 'rgba(255, 255, 255, 0.96)';
      roundedRectPath(ctx, x - width / 2, drawY - height / 2, width, height, radius);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = state.selected ? 2 : 1.25;
      ctx.strokeStyle = palette.ring;
      roundedRectPath(ctx, x - width / 2, drawY - height / 2, width, height, radius);
      ctx.stroke();

      // Mastery ring + icon glyph.
      const ringCx = x - width / 2 + 27;
      const ringCy = drawY;
      const ringR = 15;
      const pulse = meta?.category === 'weak' || meta?.category === 'learning' ? 1 + Math.sin(t * 2.4) * 0.05 : 1;

      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59, 56, 51, 0.08)';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (!isLocked) {
        const progress = Math.max(0, Math.min(1, (meta?.mastery ?? 0) / 100));
        ctx.beginPath();
        ctx.arc(ringCx, ringCy, ringR * pulse, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = palette.ring;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.font = '700 13px Inter, sans-serif';
      ctx.fillStyle = palette.ring;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(palette.icon, ringCx, ringCy + 1);

      // Mastered sparkle.
      if (meta?.category === 'mastered') {
        const sparkle = (Math.sin(t * 3 + ringCx) + 1) / 2;
        ctx.globalAlpha = sparkle * 0.9;
        ctx.fillStyle = '#BCA88A';
        ctx.beginPath();
        ctx.arc(ringCx + ringR * 0.7, ringCy - ringR * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = isLocked ? 0.55 : 1;
      }

      // Label.
      ctx.textAlign = 'left';
      ctx.font = '600 12.5px Inter, sans-serif';
      ctx.fillStyle = isLocked ? '#9E978C' : '#3B3833';
      ctx.fillText(label, x - width / 2 + 50, drawY - 6);

      ctx.font = '500 10px Inter, sans-serif';
      ctx.fillStyle = palette.text;
      const subLabel = isLocked ? 'Locked' : isRecommended ? 'Recommended next' : `${Math.round(meta?.mastery ?? 0)}% mastery`;
      ctx.fillText(subLabel, x - width / 2 + 50, drawY + 10);

      ctx.restore();
    };

    return { drawNode, nodeDimensions };
  };
}

function drawMeshGlow(ctx: CanvasRenderingContext2D, clock: number) {
  const t = clock / 4000;
  // Same warm sand/greige tint the app's own body background uses (index.css).
  const spots: Array<[number, number, number, string]> = [
    [Math.sin(t) * 400, Math.cos(t * 0.8) * 250, 420, 'rgba(188, 168, 138, 0.06)'],
    [Math.cos(t * 0.6) * -350, Math.sin(t * 1.1) * 300, 380, 'rgba(210, 201, 185, 0.06)'],
    [Math.sin(t * 1.3) * 300, Math.cos(t * 0.5) * -280, 360, 'rgba(197, 180, 155, 0.05)'],
  ];
  spots.forEach(([sx, sy, r, color]) => {
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  });
}

function drawEdgeFlow(
  ctx: CanvasRenderingContext2D,
  network: Network,
  edges: Array<{ id: string; from: string; to: string }>,
  selectedNodeId: string | null,
  clock: number,
  metaById: Record<string, NodeMeta>,
) {
  const ids = Array.from(new Set(edges.flatMap((e) => [e.from, e.to])));
  const positions = network.getPositions(ids);
  const t = clock / 1000;

  edges.forEach((edge) => {
    const a = positions[edge.from];
    const b = positions[edge.to];
    if (!a || !b) return;

    const isActive = selectedNodeId != null && (edge.from === selectedNodeId || edge.to === selectedNodeId);
    if (!isActive) return; // keep inactive edges calm — vis already renders their base line

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 18; // matches vis's horizontal-force bezier bow, approximately

    // Same traffic-light hue as the edge's own line (mastery of the source).
    const dotColor = EDGE_STATUS_COLOR[metaById[edge.from]?.category ?? 'locked'];

    // Soft glow stroke along the path so the active connection reads clearly,
    // not just the thin base line vis draws underneath.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = dotColor;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const phase = (t * 0.5 + hashStr(edge.id) * 0.37) % 1;

    [phase, (phase + 0.5) % 1].forEach((p) => {
      const pos = quadPoint(a, { x: mx, y: my }, b, p);
      ctx.save();
      ctx.shadowColor = dotColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  });
}

function quadPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
