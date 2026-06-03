import React, { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { useStudyStore } from '../../store/studyStore';
import { useUserStore } from '../../store/userStore';

const COLORS = {
  strong: {
    background: '#F0F4EF',
    border: '#8F9E8B',
    highlight: { background: '#E2EAE1', border: '#8F9E8B' },
    glow: 'rgba(143, 158, 139, 0.35)'
  },
  medium: {
    background: '#FAF5EE',
    border: '#C5B49B',
    highlight: { background: '#F3EAD9', border: '#C5B49B' },
    glow: 'rgba(197, 180, 155, 0.35)'
  },
  weak: {
    background: '#FAF0EE',
    border: '#C58F84',
    highlight: { background: '#F3DDD9', border: '#C58F84' },
    glow: 'rgba(197, 143, 132, 0.45)'
  },
  unstarted: {
    background: '#F5F3ED',
    border: '#BEB7A4',
    highlight: { background: '#E9E5DA', border: '#BEB7A4' },
    glow: 'rgba(190, 183, 164, 0.15)'
  }
};

const getMasteryCategory = (score: number) => {
  if (score >= 80) return "strong";
  if (score >= 50) return "medium";
  if (score > 0) return "weak";
  return "unstarted";
};

export const ConceptGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  
  const graphData = useStudyStore((state) => state.graphData);
  const selectedNodeId = useStudyStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useStudyStore((state) => state.setSelectedNodeId);
  const studentData = useUserStore((state) => state.studentData);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const studentTopics = studentData?.topics || {};

    // Transform nodes
    const visNodes = graphData.nodes.map(node => {
      const studentTopic = studentTopics[node.id];
      const masteryScore = studentTopic ? studentTopic.mastery_score : 0;
      const category = getMasteryCategory(masteryScore);
      const style = COLORS[category];

      return {
        id: node.id,
        label: node.display_name,
        shape: 'box',
        font: {
          color: '#3B3833',
          face: 'Inter',
          size: 13,
          bold: { color: '#3B3833', size: 13 }
        },
        color: {
          background: style.background,
          border: style.border,
          highlight: style.highlight,
          hover: style.highlight
        },
        shadow: {
          enabled: true,
          color: style.glow,
          size: 15,
          x: 0,
          y: 0
        },
        borderWidth: 2,
        borderWidthSelected: 2.5,
        margin: { top: 11, bottom: 11, left: 15, right: 15 },
        shapeProperties: { borderRadius: 8 },
        meta: {
          description: node.description,
          difficulty: node.difficulty,
          mastery: masteryScore,
          category: category,
          prerequisites: node.prerequisites
        }
      };
    });

    // Transform edges
    const visEdges = graphData.edges.map((edge, idx) => {
      return {
        id: `edge_${idx}`,
        from: edge.from,
        to: edge.to,
        arrows: 'to',
        color: {
          color: '#C2B9A7',
          highlight: '#BCA88A',
          hover: '#BCA88A',
          opacity: 0.85
        },
        width: 1.5,
        smooth: {
          type: 'cubicBezier',
          forceDirection: 'horizontal',
          roundness: 0.4
        }
      };
    });

    const data = {
      nodes: visNodes,
      edges: visEdges
    };

    const options = {
      nodes: {
        chosen: true
      },
      edges: {
        arrows: {
          to: { enabled: true, scaleFactor: 0.65, type: 'arrow' }
        },
        selectionWidth: 2
      },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        tooltipDelay: 200
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -45,
          centralGravity: 0.012,
          springLength: 120,
          springConstant: 0.06,
          damping: 0.45,
          avoidOverlap: 0.5
        },
        stabilization: {
          iterations: 140,
          fit: true
        }
      }
    };

    const network = new Network(containerRef.current, data as any, options as any);
    networkRef.current = network;

    // Set background fill canvas color
    network.on('beforeDrawing', (ctx) => {
      ctx.save();
      ctx.fillStyle = '#FAF9F6';
      ctx.fillRect(-ctx.canvas.width, -ctx.canvas.height, ctx.canvas.width * 3, ctx.canvas.height * 3);
      ctx.restore();
    });

    // Select node handler
    network.on('selectNode', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        setSelectedNodeId(nodeId);
        
        // Highlight links
        const incoming: string[] = [];
        const outgoing: string[] = [];

        visEdges.forEach(edge => {
          if (edge.to === nodeId) {
            incoming.push(edge.id);
          } else if (edge.from === nodeId) {
            outgoing.push(edge.id);
          }
        });

        const updatedEdges = visEdges.map(edge => {
          if (incoming.includes(edge.id)) {
            return { ...edge, color: { color: '#C58F84', opacity: 1 }, width: 2.5 };
          } else if (outgoing.includes(edge.id)) {
            return { ...edge, color: { color: '#8F9E8B', opacity: 1 }, width: 2.5 };
          } else {
            return { ...edge, color: { color: '#D2C9B9', opacity: 0.35 }, width: 1.0 };
          }
        });
        (network as any).body.data.edges.update(updatedEdges);
      }
    });

    network.on('deselectNode', () => {
      setSelectedNodeId(null);
      const resetEdges = visEdges.map(edge => ({
        id: edge.id,
        color: { color: '#C2B9A7', opacity: 0.85 },
        width: 1.5
      }));
      (network as any).body.data.edges.update(resetEdges);
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData, studentData, setSelectedNodeId]);

  // Focus/zoom to selected node if changed from external (e.g. clicks on sidebar prereq links)
  useEffect(() => {
    if (networkRef.current && selectedNodeId) {
      networkRef.current.selectNodes([selectedNodeId]);
      networkRef.current.focus(selectedNodeId, {
        scale: 1.1,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
    }
  }, [selectedNodeId]);

  return <div id="network-container" ref={containerRef} />;
};
