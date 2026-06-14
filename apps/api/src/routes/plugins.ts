/**
 * Plugin routes (Phase 3 in the plan; placeholder for Phase 0).
 *   GET    /plugins                list (built-in + user)
 *   POST   /plugins                create
 *   GET    /plugins/:name          detail
 *   PUT    /plugins/:name
 *   DELETE /plugins/:name
 *   POST   /plugins/:name/test     run in a sandboxed container
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { newId } from '../lib/ulid';
import { workspaceDb } from '../db/d1';

export const pluginRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

pluginRoutes.use('*', requireAuth);

pluginRoutes.get('/', async (c) => {
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const rows = await db
    .prepare('SELECT id, name, description, schema_version, is_builtin, created_at FROM plugins ORDER BY name')
    .all();
  return c.json({ plugins: rows.results });
});

const CreateBody = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().min(1).max(200),
  yaml: z.string().min(1).max(64_000),
});

pluginRoutes.post('/', async (c) => {
  const body = CreateBody.parse(await c.req.json());
  const id = `pl_${newId()}`;
  const db = workspaceDb(c.env, c.get('workspaceId'));
  await db
    .prepare(
      'INSERT INTO plugins (id, name, description, yaml, schema_version, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?)',
    )
    .bind(id, body.name, body.description, body.yaml, Date.now(), Date.now())
    .run();
  return c.json({ id, ...body }, 201);
});

pluginRoutes.get('/:name', async (c) => {
  const name = c.req.param('name');
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const row = await db.prepare('SELECT * FROM plugins WHERE name = ?').bind(name).first();
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json(row);
});

pluginRoutes.post('/:name/test', async (c) => {
  // TODO: spawn a Container, run the plugin's eval_cmd against a fixture, return parsed metric
  return c.json({ ok: true, message: 'Plugin test endpoint is a Phase 3 deliverable.' });
});
