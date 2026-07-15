import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import type { CanvasGraphPayload } from '../canvasTypes';

export interface NodePosition {
  x: number;
  y: number;
}

interface Props {
  payload: CanvasGraphPayload;
  /** Persisted positions keyed by node id — seeds layout so drags survive step changes. */
  positions?: Record<string, NodePosition>;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMoveNode?: (id: string, x: number, y: number) => void;
}

/**
 * Lightweight ad-hoc diagram renderer for the AI Canvas — a fresh, small
 * vis-network instance per step (not the big Knowledge Graph). Deliberately
 * simpler styling than ConceptGraph's custom ctxRenderer cards: this is a
 * disposable teaching sketch, redrawn every step, not a persistent map.
 *
 * Interactivity (selection + drag persistence) is wired through refs so the
 * network is only rebuilt when the *payload* changes — updating positions or
 * selection never tears down and recreates the network (which would flicker).
 */
export const GraphRenderer: React.FC<Props> = ({ payload, positions, selectedId, onSelect, onMoveNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  // Live refs so the effect can read the latest without re-subscribing.
  const positionsRef = useRef(positions);
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMoveNode);
  positionsRef.current = positions;
  onSelectRef.current = onSelect;
  onMoveRef.current = onMoveNode;

  useEffect(() => {
    if (!containerRef.current) return;

    const isTree = payload.layout === 'tree';
    const stored = positionsRef.current || {};
    const interactive = !!onSelectRef.current;
    // If every node has a saved position we can skip physics entirely and just
    // place them — that keeps a previously arranged graph perfectly stable.
    const allPlaced = !isTree && payload.nodes.length > 0 && payload.nodes.every((n) => stored[n.id]);

    const nodes = payload.nodes.map((n) => {
      const pos = stored[n.id];
      return {
        id: n.id,
        label: n.label,
        shape: 'box' as const,
        margin: { top: 10, bottom: 10, left: 14, right: 14 },
        shapeProperties: { borderRadius: 10 },
        font: { color: '#3B3833', face: 'Inter', size: 14 },
        color: n.highlight
          ? { background: '#FAF5EE', border: '#BCA88A', highlight: { background: '#FAF5EE', border: '#BCA88A' } }
          : { background: '#FFFFFF', border: '#D2C9B9', highlight: { background: '#FFFFFF', border: '#BCA88A' } },
        borderWidth: n.highlight ? 2.5 : 1.5,
        shadow: n.highlight
          ? { enabled: true, color: 'rgba(188,168,138,0.4)', size: 14, x: 0, y: 0 }
          : { enabled: true, color: 'rgba(59,56,51,0.08)', size: 6, x: 0, y: 2 },
        ...(pos ? { x: pos.x, y: pos.y } : {}),
      };
    });

    const edges = payload.edges.map((e, idx) => ({
      id: `e${idx}`,
      from: e.from,
      to: e.to,
      label: e.label || undefined,
      arrows: payload.directed !== false ? 'to' : undefined,
      font: { size: 11, color: '#9E978C', strokeWidth: 0 },
      color: {
        color: e.highlight ? '#BCA88A' : '#D2C9B9',
        opacity: e.highlight ? 1 : 0.7,
      },
      width: e.highlight ? 2.5 : 1.5,
      smooth: isTree
        ? { enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.5 }
        : { enabled: true, type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.45 },
    }));

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      (isTree
        ? {
            autoResize: true,
            interaction: { dragNodes: true, dragView: true, zoomView: true, hover: interactive, selectable: interactive },
            layout: {
              hierarchical: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 90,
                nodeSpacing: 130,
              },
            },
            physics: { enabled: false },
          }
        : {
            autoResize: true,
            interaction: { dragNodes: true, dragView: true, zoomView: true, hover: interactive, selectable: interactive },
            physics: {
              enabled: !allPlaced,
              solver: 'forceAtlas2Based',
              forceAtlas2Based: { gravitationalConstant: -60, springLength: 110, springConstant: 0.08, damping: 0.5 },
              stabilization: { iterations: 120, fit: true },
            },
          }) as never,
    );
    networkRef.current = network;

    // Selection: report the clicked node (or null when clicking empty space).
    if (interactive) {
      network.on('click', (params: { nodes: string[] }) => {
        const id = params.nodes && params.nodes.length > 0 ? params.nodes[0] : null;
        onSelectRef.current?.(id);
      });
    }

    // Persist positions after the layout settles and after any manual drag, so
    // the arrangement survives step changes.
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
  }, [payload]);

  // Reflect external selection changes without rebuilding the network.
  useEffect(() => {
    const net = networkRef.current;
    if (!net) return;
    try {
      if (selectedId) net.selectNodes([selectedId]);
      else net.unselectAll();
    } catch {
      /* node may not exist in this step — ignore */
    }
  }, [selectedId]);

  return <div className="ai-canvas-graph" ref={containerRef} />;
};

export default GraphRenderer;
