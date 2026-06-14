/**
 * LLM key routes.
 *   GET    /me/llm-keys          list (masked)
 *   POST   /me/llm-keys          save (envelope-encrypted)
 *   DELETE /me/llm-keys/:provider
 *
 * LLM keys are NEVER logged, NEVER written to a Worker secret, NEVER put in a Pages env.
 * They are AES-GCM encrypted with a per-workspace DEK (which is itself wrapped by the master KEK).
 * The plaintext is decrypted only inside the Container at run start, injected as env vars, and zeroed on exit.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { encryptForWorkspace, maskedKey } from '../security/seal';
import { workspaceDb } from '../db/d1';

export const llmKeyRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

llmKeyRoutes.use('*', requireAuth);

llmKeyRoutes.get('/', async (c) => {
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const rows = await db
    .prepare('SELECT provider, base_url, created_at FROM project_secrets')
    .all<{ provider: string; base_url: string | null; created_at: number }>();
  return c.json({
    keys: rows.results.map((r) => ({ provider: r.provider, baseUrl: r.base_url, createdAt: r.created_at })),
  });
});

const SaveBody = z.object({
  provider: z.enum(['anthropic', 'openai', 'litellm', 'custom']),
  apiKey: z.string().min(1).max(1000),
  baseUrl: z.string().url().optional(),
});

llmKeyRoutes.post('/', async (c) => {
  const body = SaveBody.parse(await c.req.json());
  const wid = c.get('workspaceId');
  const { ciphertext, nonce, dekId } = await encryptForWorkspace(wid, body.apiKey, c.env);
  const db = workspaceDb(c.env, wid);
  await db
    .prepare(
      `INSERT INTO project_secrets (workspace_id, provider, dek_id, ciphertext, nonce, base_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace_id, provider) DO UPDATE SET
         dek_id = excluded.dek_id,
         ciphertext = excluded.ciphertext,
         nonce = excluded.nonce,
         base_url = excluded.base_url,
         created_at = excluded.created_at`,
    )
    .bind(wid, body.provider, dekId, ciphertext, nonce, body.baseUrl ?? null, Date.now())
    .run();
  return c.json({ provider: body.provider, masked: maskedKey(body.apiKey) }, 201);
});

llmKeyRoutes.delete('/:provider', async (c) => {
  const provider = c.req.param('provider');
  const db = workspaceDb(c.env, c.get('workspaceId'));
  await db.prepare('DELETE FROM project_secrets WHERE workspace_id = ? AND provider = ?')
    .bind(c.get('workspaceId'), provider)
    .run();
  return c.json({ ok: true });
});
