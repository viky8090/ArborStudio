import { authRedirect } from '@/lib/auth';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

export default async function DashboardPage() {
  // Server component: if no cookie, redirect to /login
  await authRedirect();
  // Fetch the user's recent runs (Phase 0: simple list)
  let runs: Array<{ id: string; name: string; status: string; createdAt: number }> = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/projects/p_demo/runs`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { runs: typeof runs };
      runs = data.runs ?? [];
    }
  } catch {
    // server-side fetch to local API not available; render empty
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Active runs</div>
          <div className="text-3xl font-semibold">{runs.filter((r) => r.status === 'running').length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total runs</div>
          <div className="text-3xl font-semibold">{runs.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Cost (this month)</div>
          <div className="text-3xl font-semibold">$0.00</div>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">Recent runs</h2>
        {runs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No runs yet. <Link className="underline" href="/projects">Connect a project</Link> to get started.
          </div>
        ) : (
          <ul className="space-y-1">
            {runs.map((r) => (
              <li key={r.id} className="rounded border p-3 text-sm">
                <Link className="hover:underline" href={`/projects/p_demo/runs/${r.id}`}>
                  {r.name} <span className="text-muted-foreground">— {r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
