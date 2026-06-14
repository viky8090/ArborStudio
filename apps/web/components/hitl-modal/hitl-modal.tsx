'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Payload = Record<string, unknown>;

export function HitlModal({
  payload,
  expiresAt,
  onApprove,
  onReject,
}: {
  payload: Payload;
  expiresAt: number;
  onApprove: (rationale: string) => Promise<void>;
  onReject: (rationale: string) => Promise<void>;
}) {
  const [rationale, setRationale] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      <div className="bg-card border rounded-lg w-full max-w-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Approve this idea?</h2>
            <p className="text-xs text-muted-foreground">Auto-rejects in {secondsLeft}s</p>
          </div>
        </div>

        <div className="rounded-md border bg-background p-3 text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Title: </span>
            <span className="font-medium">{(payload.title as string) ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Depth: </span>
            <span>{(payload.depth as number) ?? '—'}</span>
          </div>
          {payload.rationale != null && (
            <div>
              <span className="text-muted-foreground">Rationale: </span>
              <span>{String(payload.rationale)}</span>
            </div>
          )}
          {payload.expected_impact != null && (
            <div>
              <span className="text-muted-foreground">Expected impact: </span>
              <span>{String(payload.expected_impact)}</span>
            </div>
          )}
        </div>

        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Optional rationale (saved to audit log)…"
          className="w-full h-20 rounded-md border bg-background p-2 text-sm"
        />

        <div className="flex justify-end gap-2">
          <Button variant="destructive" onClick={() => onReject(rationale)}>
            Reject
          </Button>
          <Button onClick={() => onApprove(rationale)}>Approve</Button>
        </div>
      </div>
    </div>
  );
}
