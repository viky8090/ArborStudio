/**
 * Workspace routes.
 *   GET    /workspaces                    list user's workspaces
 *   POST   /workspaces                    create a new workspace
 *   GET    /workspaces/:wid               get workspace detail
 *   PATCH  /workspaces/:wid               update workspace
 *   GET    /workspaces/:wid/members       list members
 *   POST   /workspaces/:wid/members       invite member
 *
 * Workspace creation also provisions a D1 database for that workspace
 * (in production; for local dev we share DB_WS_DEFAULT).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth, requireRole } from '../auth/middleware';
import { HttpError } from '../errors';
import { newId } from '../lib/ulid';

export const workspaceRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

workspaceRoutes.use('*', requireAuth);

workspaceRoutes.get('/', async (c) => {
  const rows = await c.env.DB_META.prepare(
    `SELECT w.id, w.name, w.plan, w.created_at, wm.role
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = ?
     ORDER BY w.created_at ASC`,
  )
    .bind(c.get('userId'))
    .all();
  return c.json({ workspaces: rows.results });
});

const CreateBody = z.object({ name: z.string().min(1).max(80).trim() });

workspaceRoutes.post('/', async (c) => {
  const body = CreateBody.parse(await c.req.json());
  const wid = `ws_${newId()}`;
  const now = Date.now();
  await c.env.DB_META.batch([
    c.env.DB_META.prepare(
      'INSERT INTO workspaces (id, name, owner_id, plan, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(wid, body.name, c.get('userId'), 'free', now),
    c.env.DB_META.prepare(
      'INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
    ).bind(wid, c.get('userId'), 'owner', now),
  ]);
  // TODO: in production, create a new D1 database for this workspace via the Cloudflare API
  // For now, all workspaces share DB_WS_DEFAULT in dev.
  return c.json({ id: wid, name: body.name, plan: 'free' }, 201);
});

workspaceRoutes.get('/:wid', async (c) => {
  const wid = c.req.param('wid');
  await assertMember(c, wid);
  const w = await c.env.DB_META.prepare('SELECT id, name, plan, created_at FROM workspaces WHERE id = ?')
    .bind(wid)
    .first();
  if (!w) throw new HttpError(404, 'Not Found');
  return c.json(w);
});

workspaceRoutes.get('/:wid/members', async (c) => {
  const wid = c.req.param('wid');
  await assertMember(c, wid);
  const rows = await c.env.DB_META.prepare(
    `SELECT u.id, u.email, u.name, wm.role, wm.created_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?`,
  )
    .bind(wid)
    .all();
  return c.json({ members: rows.results });
});

const InviteBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['admin', 'researcher', 'viewer']).default('researcher'),
});

workspaceRoutes.post('/:wid/members', async (c) => {
  const wid = c.req.param('wid');
  await requireRole(c, wid, ['owner', 'admin']);
  const body = InviteBody.parse(await c.req.json());
  // TODO: send an invite email; for now, attach directly if user exists
  const user = await c.env.DB_META.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email)
    .first<{ id: string }>();
  if (!user) throw new HttpError(404, 'Not Found', 'No user with that email.');
  await c.env.DB_META.prepare(
    'INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(wid, user.id, body.role, Date.now())
    .run();
  return c.json({ ok: true }, 201);
});

async function assertMember(c: { env: Env; get: (k: string) => string }, wid: string): Promise<void> {
  const m = await c.env.DB_META.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
  )
    .bind(wid, c.get('userId'))
    .first<{ role: string }>();
  if (!m) throw new HttpError(403, 'Forbidden', 'You are not a member of this workspace.');
}
