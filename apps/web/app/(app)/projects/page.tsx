import { authRedirect } from '@/lib/auth';
import { NewProjectCard, ProjectList } from '@/components/projects/project-list';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

type Project = {
  id: string;
  name: string;
  repoUrl: string | null;
  baselineMetric: number | null;
  createdAt: number;
};

export default async function ProjectsPage() {
  await authRedirect();

  let projects: Project[] = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/projects`, { cache: 'no-store', credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { projects: Project[] };
      projects = data.projects ?? [];
    }
  } catch {
    // server-side fetch to local API not available; render empty
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <NewProjectCard />
        <Card>
          <CardHeader>
            <CardTitle>Your projects</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectList projects={projects} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
