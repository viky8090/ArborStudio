'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

type Project = {
  id: string;
  name: string;
  repoUrl: string | null;
  baselineMetric: number | null;
  createdAt: number;
};

export function NewProjectCard() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [baselineMetric, setBaselineMetric] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/projects`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          repoUrl: repoUrl || undefined,
          baselineMetric: baselineMetric ? Number(baselineMetric) : undefined,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(detail.detail ?? 'Project creation failed.');
      }
      const created = (await res.json()) as Project;
      router.push(`/projects/${created.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="url"
            placeholder="GitHub repo URL (optional in Phase 0)"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="number"
            step="0.0001"
            placeholder="Baseline metric (optional)"
            value={baselineMetric}
            onChange={(e) => setBaselineMetric(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create project'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No projects yet. Create one to get started.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {projects.map((p) => (
        <li key={p.id} className="rounded border p-3 text-sm">
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-muted-foreground">
            {p.repoUrl ?? 'no repo'} · baseline {p.baselineMetric ?? '—'}
          </div>
        </li>
      ))}
    </ul>
  );
}
