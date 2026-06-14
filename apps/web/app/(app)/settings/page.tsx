import { authRedirect } from '@/lib/auth';
import { LlmKeysCard } from '@/components/settings/llm-keys-card';

export default async function SettingsPage() {
  await authRedirect();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <LlmKeysCard />
      </div>
    </div>
  );
}
