import React, { useEffect, useMemo, useRef } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import type { CanvasMindMapPayload } from '../canvasTypes';
import type { NodePosition } from './GraphRenderer';

interface Props {
  payload: CanvasMindMapPayload;
  positions?: Record<string, NodePosition>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
}

const ROOT_ID = '__mm_root__';
const BRANCH_COLORS = ['#B08968', '#5E8B7E', '#8A6FB0', '#C08552', '#4A7BA6', '#A6584F', '#6B8E4E'];

/**
 * Mind map — the parent-pointer node list is turned into a real radial/
 * hierarchical map with a bold central node and colour-coded branches. Nodes
 * are draggable (positions persist) and clickable (selection → inspector).
 */
export const MindMapRenderer: React.FC<Props> = ({ payload, positions, selectedId, onSelect, onMoveNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const positionsRef = useRef(positions);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMoveNode);
  positionsRef.current = positions;
  onSelectRef.current = onSelect;
  onMoveRef.current = onMoveNode;

  // Resolve a colour per node by walking up to its top-level branch.
  const colorFor = useMemo(() => {
    const byId = new Map(payload.nodes.map((n) => [n.id, n]));
    const topBranchIndex = new Map<string, number>();
    const topLevel = payload.nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
    topLevel.forEach((n, i) => topBranchIndex.set(n.id, i));

    const resolve = (id: string, guard = 0): number => {
      if (topBranchIndex.has(id)) return topBranchIndex.get(id)!;
      const node = byId.get(id);
      if (!node || !node.parentId || guard > 50) return 0;
      return resolve(node.parentId, guard + 1);
    };
    const map: Record<string, string> = {};
    payload.nodes.forEach((n) => {
      map[n.id] = n.color || BRANCH_COLORS[resolve(n.id) % BRANCH_COLORS.length];
    });
    return map;
  }, [payload]);

  useEffect(() => {
    if (!containerRef.current) return;
    const stored = positionsRef.current || {};
    const interactive = !!onSelectRef.current;
    const byId = new Map(payload.nodes.map((n) => [n.id, n]));

    const nodes: Record<string, unknown>[] = [
      {
        id: ROOT_ID,
        label: payload.root || 'Central idea',
        shape: 'ellipse',
        font: { color: '#FFFFFF', face: 'Inter', size: 17, bold: { color: '#FFFFFF' } },
        color: { background: '#3B3833', border: '#3B3833' },
        margin: { top: 14, bottom: 14, left: 20, right: 20 },
        ...(stored[ROOT_ID] ? { x: stored[ROOT_ID].x, y: stored[ROOT_ID].y } : {}),
      },
      ...payload.nodes.map((n) => {
        const pos = stored[n.id];
        const c = colorFor[n.id];
        return {
          id: n.id,
          label: n.label,
          shape: 'box' as const,
          shapeProperties: { borderRadius: 12 },
          margin: { top: 8, bottom: 8, left: 13, right: 13 },
          font: { color: '#3B3833', face: 'Inter', size: 13 },
          color: { background: '#FFFFFF', border: c, highlight: { background: '#FAF5EE', border: c } },
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(59,56,51,0.08)', size: 6, x: 0, y: 2 },
          ...(pos ? { x: pos.x, y: pos.y } : {}),
        };
      }),
    ];

    const edges = payload.nodes.map((n) => {
      const parent = n.parentId && byId.has(n.parentId) ? n.parentId : ROOT_ID;
      return {
        from: parent,
        to: n.id,
        color: { color: colorFor[n.id], opacity: 0.75 },
        width: 2,
        smooth: { enabled: true, type: 'cubicBezier', roundness: 0.5 },
      };
    });

    const allPlaced = nodes.length > 0 && nodes.every((n) => stored[n.id as string]);

    const network = new Network(
      containerRef.current,
      { nodes: nodes as never, edges },
      {
        autoResize: true,
        interaction: { dragNodes: true, dragView: true, zoomView: true, hover: interactive, selectable: interactive },
        physics: {
          enabled: !allPlaced,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -80, centralGravity: 0.012, springLength: 120, springConstant: 0.06, damping: 0.6 },
          stabilization: { iterations: 150, fit: true },
        },
      } as never,
    );
    networkRef.current = network;

    if (interactive) {
      network.on('click', (params: { nodes: string[] }) => {
        const id = params.nodes && params.nodes.length > 0 ? params.nodes[0] : null;
        onSelectRef.current?.(id === ROOT_ID ? null : id);
      });
    }

    const persistAll = () => {
      const pos = network.getPositions();
      Object.entries(pos).forEach(([id, p]) => onMoveRef.current?.(id, p.x, p.y));
    };
    network.on('stabilizationIterationsDone', () => {
      network.setOptions({ physics: false });
      persistAll();
    });
    network.on('dragEnd', (params: { nodes: string[] }) => {
      if (!params.nodes || params.nodes.length === 0) return;
      const pos = network.getPositions(params.nodes);
      Object.entries(pos).forEach(([id, p]) => onMoveRef.current?.(id, p.x, p.y));
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [payload, colorFor]);

  useEffect(() => {
    const net = networkRef.current;
    if (!net) return;
    try {
      if (selectedId) net.selectNodes([selectedId]);
      else net.unselectAll();
    } catch {
      /* ignore missing node */
    }
  }, [selectedId]);

  return <div className="ai-canvas-graph" ref={containerRef} />;
};

export default MindMapRenderer;
