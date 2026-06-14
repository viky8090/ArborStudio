'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

export function ReportViewer({ runId, isReady }: { runId: string; isReady: boolean }) {
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await api<{ url?: string; report?: string }>(
          `/api/v1/projects/p_demo/runs/${runId}/report`,
        );
        if (cancelled) return;
        if (r.report) setReport(r.report);
        else if (r.url) setReport(`[Phase 0] R2 signed URL: ${r.url}`);
        else setReport('(empty report)');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, isReady]);

  if (!isReady) {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
        Report is generated when the run finishes. Pause/Resume/Cancel controls are above.
      </div>
    );
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading report…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;

  return (
    <article className="prose prose-invert max-w-none">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{report}</pre>
    </article>
  );
}
