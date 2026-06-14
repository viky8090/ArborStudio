import { authRedirect } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function TeamPage() {
  await authRedirect();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 5 deliverable. For now, see <code>apps/api/src/routes/workspaces.ts</code> for
            the <code>POST /workspaces/:wid/members</code> endpoint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
