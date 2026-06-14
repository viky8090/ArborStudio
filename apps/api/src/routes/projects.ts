/**
 * Project routes.
 *   GET    /projects                              list (across user's workspaces)
 *   POST   /projects                              create (body: {workspaceId, name, repoUrl | tarballUrl, ...})
 *   GET    /projects/:pid                         detail
 *   PATCH  /projects/:pid                         update
 *   DELETE /projects/:pid                         soft delete
 *   GET    /projects/:pid/configs                 list versioned research_config.yaml
 *   POST   /projects/:pid/configs                 upload new version
 *
 * Phase 0: single shared DB_WS_DEFAULT for all workspaces.
 * Production: per-workspace D1 binding via resolver.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { HttpError } from '../errors';
import { newId } from '../lib/ulid';
import { workspaceDb } from '../db/d1';

export const projectRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

projectRoutes.use('*', requireAuth);

projectRoutes.get('/', async (c) => {
  const wid = c.req.query('workspaceId') ?? c.get('workspaceId');
  const db = workspaceDb(c.env, wid);
  const rows = await db
    .prepare('SELECT id, name, repo_url, default_branch, baseline_metric, created_at FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100')
    .all();
  return c.json({ projects: rows.results });
});

const CreateBody = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1).max(120).trim(),
  repoUrl: z.string().url().optional(),
  defaultBranch: z.string().default('main'),
  baselineMetric: z.number().optional(),
});

projectRoutes.post('/', async (c) => {
  const body = CreateBody.parse(await c.req.json());
  const wid = body.workspaceId ?? c.get('workspaceId');
  const pid = `p_${newId()}`;
  const now = Date.now();
  const db = workspaceDb(c.env, wid);
  await db
    .prepare(
      `INSERT INTO projects (id, name, repo_url, default_branch, baseline_metric, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(pid, body.name, body.repoUrl ?? null, body.defaultBranch, body.baselineMetric ?? null, now, now)
    .run();
  return c.json({ id: pid, ...body }, 201);
});

projectRoutes.get('/:pid', async (c) => {
  const pid = c.req.param('pid');
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const row = await db
    .prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
    .bind(pid)
    .first();
  if (!row) throw new HttpError(404, 'Not Found');
  return c.json(row);
});

const PatchBody = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  repoUrl: z.string().url().optional(),
  defaultBranch: z.string().optional(),
  baselineMetric: z.number().optional(),
});

projectRoutes.patch('/:pid', async (c) => {
  const pid = c.req.param('pid');
  const body = PatchBody.parse(await c.req.json());
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const fields = Object.keys(body);
  if (fields.length === 0) return c.json({ ok: true });
  const set = fields.map((f) => `${camelToSnake(f)} = ?`).join(', ');
  const values = fields.map((f) => (body as Record<string, unknown>)[f]);
  await db
    .prepare(`UPDATE projects SET ${set}, updated_at = ? WHERE id = ?`)
    .bind(...values, Date.now(), pid)
    .run();
  return c.json({ ok: true });
});

projectRoutes.delete('/:pid', async (c) => {
  const pid = c.req.param('pid');
  const db = workspaceDb(c.env, c.get('workspaceId'));
  await db.prepare('UPDATE projects SET deleted_at = ? WHERE id = ?').bind(Date.now(), pid).run();
  return c.json({ ok: true });
});

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
