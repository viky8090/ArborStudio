'use client';

import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type TreeNode = {
  id: string;
  parent_id: string | null;
  depth: number;
  title: string;
  status: 'pending' | 'running' | 'merged' | 'pruned' | 'done' | 'failed';
  score: number | null;
  insight: string | null;
  branch: string | null;
  cycle: number;
};

const STATUS_FILL: Record<TreeNode['status'], string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  merged: '#22c55e',
  pruned: '#ef4444',
  done: '#a855f7',
  failed: '#f59e0b',
};

export function IdeaTree({ nodes }: { nodes: TreeNode[] }) {
  const { flowNodes, flowEdges } = useMemo(() => {
    // Tidy tree layout: x = depth * 220, y = index-in-depth * 80
    const byDepth = new Map<number, TreeNode[]>();
    for (const n of nodes) {
      const arr = byDepth.get(n.depth) ?? [];
      arr.push(n);
      byDepth.set(n.depth, arr);
    }
    const flowNodes: Node[] = nodes.map((n) => {
      const arr = byDepth.get(n.depth) ?? [];
      const idx = arr.indexOf(n);
      return {
        id: n.id,
        position: { x: n.depth * 240, y: idx * 80 },
        data: { label: n.title, status: n.status, score: n.score, cycle: n.cycle },
        style: {
          background: '#0b0f1a',
          color: '#e2e8f0',
          border: `2px solid ${STATUS_FILL[n.status]}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          maxWidth: 200,
        },
      };
    });
    const flowEdges: Edge[] = nodes
      .filter((n) => n.parent_id)
      .map((n) => ({
        id: `${n.parent_id}->${n.id}`,
        source: n.parent_id as string,
        target: n.id,
        style: { stroke: '#475569', strokeWidth: 1 },
      }));
    return { flowNodes, flowEdges };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Waiting for the first tree event… (the Container emits synthetic events in Phase 0)
      </div>
    );
  }

  return (
    <ReactFlow nodes={flowNodes} edges={flowEdges} fitView fitViewOptions={{ padding: 0.2 }} proOptions={{ hideAttribution: true }}>
      <Background gap={16} color="#1e293b" />
      <Controls className="!bg-card !border-border" />
      <MiniMap className="!bg-card !border-border" nodeColor={(n) => STATUS_FILL[(n.data as any).status as TreeNode['status']] ?? '#94a3b8'} />
    </ReactFlow>
  );
}
