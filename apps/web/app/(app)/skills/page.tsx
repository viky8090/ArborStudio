import { authRedirect } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SkillsPage() {
  await authRedirect();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Skills</h1>
      <Card>
        <CardHeader>
          <CardTitle>Skill library</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Phase 3 deliverable. Skill editor + "Generate with AI" ships then.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
