import { authRedirect } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function IntegrationsPage() {
  await authRedirect();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {['Slack', 'GitHub PR', 'Linear', 'Webhooks'].map((name) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Phase 6 deliverable. See <code>apps/api/src/routes/integrations.ts</code>.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
