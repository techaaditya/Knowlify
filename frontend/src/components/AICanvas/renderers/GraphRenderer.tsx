import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import type { CanvasGraphPayload } from '../canvasTypes';

interface Props {
  payload: CanvasGraphPayload;
}

/**
 * Lightweight ad-hoc diagram renderer for the AI Canvas — a fresh, small
 * vis-network instance per step (not the big Knowledge Graph). Deliberately
 * simpler styling than ConceptGraph's custom ctxRenderer cards: this is a
 * disposable teaching sketch, redrawn every step, not a persistent map.
 */
export const GraphRenderer: React.FC<Props> = ({ payload }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const nodes = payload.nodes.map((n) => ({
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
    }));

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
      smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.45 },
    }));

    const network = new Network(
      containerRef.current,
      { nodes, edges },
      {
        autoResize: true,
        interaction: { dragNodes: true, dragView: true, zoomView: true, hover: false, selectable: false },
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -60, springLength: 110, springConstant: 0.08, damping: 0.5 },
          stabilization: { iterations: 120, fit: true },
        },
      } as never,
    );
    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [payload]);

  return <div className="ai-canvas-graph" ref={containerRef} />;
};

export default GraphRenderer;
