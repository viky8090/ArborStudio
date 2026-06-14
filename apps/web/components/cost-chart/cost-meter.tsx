'use client';

import { useMemo } from 'react';
import type { RunEvent } from '@/hooks/useRunSocket';

export function CostMeter({ events }: { events: RunEvent[] }) {
  const points = useMemo(() => {
    const ticks = events.filter((e) => e.type === 'cost.tick');
    return ticks.map((e) => ({
      ts: e.ts,
      usd: ((e.data as { costUsd?: number }).costUsd ?? 0) as number,
      tokensIn: ((e.data as { tokensIn?: number }).tokensIn ?? 0) as number,
      tokensOut: ((e.data as { tokensOut?: number }).tokensOut ?? 0) as number,
    }));
  }, [events]);

  if (points.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
        No cost ticks yet. Cost appears here as the Container emits cost.tick events.
      </div>
    );
  }

  const maxUsd = Math.max(...points.map((p) => p.usd), 0.0001);
  const width = 720;
  const height = 280;
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width;
      const y = height - (p.usd / maxUsd) * (height - 20) - 10;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <span className="text-muted-foreground">Latest: </span>
        <span className="font-mono">${points[points.length - 1]!.usd.toFixed(6)}</span>
        <span className="text-muted-foreground"> · total ticks: </span>
        <span className="font-mono">{points.length}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 bg-card rounded border">
        <path d={path} fill="none" stroke="#22c55e" strokeWidth={2} />
        {points.map((p, i) => {
          const x = (i / Math.max(points.length - 1, 1)) * width;
          const y = height - (p.usd / maxUsd) * (height - 20) - 10;
          return <circle key={i} cx={x} cy={y} r={2.5} fill="#22c55e" />;
        })}
        <line x1={0} y1={height - 10} x2={width} y2={height - 10} stroke="#475569" />
      </svg>
    </div>
  );
}
