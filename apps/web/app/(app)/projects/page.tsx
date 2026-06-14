'use client';

import { useState } from 'react';
import { useRunSocket, type RunEvent } from '@/hooks/useRunSocket';

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <p className="text-sm text-muted-foreground">
        Phase 0 placeholder. Real project creation comes in Phase 1.
      </p>
      <RunDemo />
    </div>
  );
}

/**
 * A live demo of the run socket. Click "Launch" to start a phase-0 run;
 * watch events stream in real-time. This is the seed of the future Run detail view.
 */
function RunDemo() {
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [pending, setPending] = useState(false);

  useRunSocket(runId ?? '', {
    onEvent: (evt) => setEvents((prev) => [...prev.slice(-100), evt]),
    onOpen: () => setEvents((p) => [...p, { v: 1, type: 'ws.open', ts: Date.now(), run_id: runId ?? '', data: {} }]),
  });

  async function launch() {
    setPending(true);
    setEvents([]);
    try {
      // Phase 0: hardcode a project id; in production, the user picks from a list
      const res = await fetch('http://127.0.0.1:8787/api/v1/projects/p_demo/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          goal: 'Hello from the dashboard',
          mode: 'auto',
          maxCycles: 1,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: string; wsUrl: string };
      setRunId(data.id);
    } catch (err) {
      setEvents((p) => [
        ...p,
        { v: 1, type: 'error.local', ts: Date.now(), run_id: '', data: { message: (err as Error).message } },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={launch}
        disabled={pending || runId !== null}
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Launching…' : runId ? `Run ${runId.slice(0, 10)}…` : 'Launch phase-0 run'}
      </button>
      <pre className="rounded-lg border bg-muted/40 p-3 text-xs font-mono h-64 overflow-auto">
        {events.length === 0
          ? 'No events yet. Click "Launch" to start a phase-0 run.'
          : events
              .map((e) => `[${new Date(e.ts).toISOString()}] ${e.type}  ${JSON.stringify(e.data).slice(0, 200)}`)
              .join('\n')}
      </pre>
    </div>
  );
}
