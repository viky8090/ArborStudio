'use client';

import { useEffect, useRef } from 'react';
import type { RunEvent } from '@/hooks/useRunSocket';

const STATUS_COLOR: Record<string, string> = {
  'cycle.started': 'text-blue-400',
  'cycle.completed': 'text-green-400',
  'tree.node.added': 'text-purple-400',
  'tree.node.merged': 'text-green-400',
  'tree.node.pruned': 'text-red-400',
  'idea.proposed': 'text-yellow-400',
  'cost.tick': 'text-cyan-400',
  'error.raised': 'text-red-400',
  'log.line': 'text-muted-foreground',
  'run.started': 'text-green-400',
  'run.completed': 'text-green-400',
  'run.cancelled': 'text-red-400',
  'run.failed': 'text-red-400',
};

export function CycleLog({ events }: { events: RunEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events]);

  return (
    <div
      ref={ref}
      className="h-[600px] overflow-auto font-mono text-xs leading-relaxed"
    >
      {events.length === 0 ? (
        <div className="text-muted-foreground">No events yet.</div>
      ) : (
        events.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-muted-foreground shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
            <span className={`shrink-0 ${STATUS_COLOR[e.type] ?? 'text-foreground'}`}>{e.type}</span>
            <span className="truncate text-muted-foreground">
              {e.type === 'log.line'
                ? (e.data as { line?: string }).line
                : JSON.stringify(e.data).slice(0, 240)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
