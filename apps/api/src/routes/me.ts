/**
 * Current user routes.
 *   GET  /me      current user + memberships
 *   PATCH /me     update profile
 *
 * Requires auth (JWT in arbor_access cookie or Authorization header).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';

export const meRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; workspaceId: string; role: string } }>();

meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const user = await c.env.DB_META.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?',
  )
    .bind(c.get('userId'))
    .first<{ id: string; email: string; name: string; created_at: number }>();
  if (!user) return c.json({ error: 'not_found' }, 404);

  const memberships = await c.env.DB_META.prepare(
    `SELECT wm.workspace_id, wm.role, w.name AS workspace_name
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = ?`,
  )
    .bind(c.get('userId'))
    .all();

  return c.json({ user, memberships: memberships.results });
});

const PatchBody = z.object({
  name: z.string().min(1).max(80).trim().optional(),
});

meRoutes.patch('/', async (c) => {
  const body = PatchBody.parse(await c.req.json());
  if (body.name) {
    await c.env.DB_META.prepare('UPDATE users SET name = ? WHERE id = ?')
      .bind(body.name, c.get('userId'))
      .run();
  }
  return c.json({ ok: true });
});
