'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';

const PROVIDERS = ['anthropic', 'openai', 'litellm', 'custom'] as const;
type Provider = (typeof PROVIDERS)[number];

type KeyRow = { provider: Provider; baseUrl: string | null; createdAt: number };

export function LlmKeysCard() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/llm-keys`, { credentials: 'include' });
      if (r.ok) {
        const data = (await r.json()) as { keys: KeyRow[] };
        setKeys(data.keys ?? []);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const r = await fetch(`${API_BASE_URL}/api/v1/llm-keys`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          apiKey,
          baseUrl: baseUrl || undefined,
        }),
      });
      if (!r.ok) {
        const detail = (await r.json().catch(() => ({}))) as { detail?: string };
        throw new Error(detail.detail ?? 'Save failed.');
      }
      setStatus('Saved. The key is AES-GCM encrypted with a per-workspace DEK and never leaves the Container in plaintext.');
      setApiKey('');
      setBaseUrl('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(p: Provider) {
    if (!confirm(`Delete ${p} key?`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/llm-keys/${p}`, { method: 'DELETE', credentials: 'include' });
      await load();
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM API keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Keys are encrypted with a per-workspace DEK (envelope encryption). The plaintext
          is decrypted only inside the Container at run start, injected as env vars, and zeroed
          on exit. See <code>docs/adr/0004-llm-keys-never-leave-container.md</code>.
        </p>

        {keys.length > 0 && (
          <div className="space-y-1">
            {keys.map((k) => (
              <div key={k.provider} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <span className="font-mono">{k.provider}</span>
                  {k.baseUrl && <span className="text-xs text-muted-foreground ml-2">{k.baseUrl}</span>}
                </div>
                <Button size="sm" variant="destructive" onClick={() => onDelete(k.provider)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={onSave} className="space-y-2 border-t pt-4">
          <div className="flex gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type={provider === 'litellm' || provider === 'custom' ? 'text' : 'password'}
              required
              placeholder={provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'API key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          {(provider === 'litellm' || provider === 'custom') && (
            <input
              type="url"
              placeholder="https://your-gateway/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {status && <p className="text-sm text-green-400">{status}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save key'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
