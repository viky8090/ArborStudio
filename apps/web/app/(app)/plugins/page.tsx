import { authRedirect } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PluginsPage() {
  await authRedirect();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Plugins</h1>
      <Card>
        <CardHeader>
          <CardTitle>Plugin library</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 3 deliverable. Plugin editor + test sandbox ships then.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
