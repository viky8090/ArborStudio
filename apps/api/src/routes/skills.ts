/**
 * Skill routes (Phase 3 in the plan; placeholder for Phase 0).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { newId } from '../lib/ulid';
import { workspaceDb } from '../db/d1';

export const skillRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

skillRoutes.use('*', requireAuth);

skillRoutes.get('/', async (c) => {
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const rows = await db
    .prepare('SELECT id, name, description, is_builtin, created_at FROM skills ORDER BY name')
    .all();
  return c.json({ skills: rows.results });
});

const CreateBody = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().min(1).max(200),
  frontMatter: z.record(z.unknown()).default({}),
  markdown: z.string().min(1).max(64_000),
});

skillRoutes.post('/', async (c) => {
  const body = CreateBody.parse(await c.req.json());
  const id = `sk_${newId()}`;
  const db = workspaceDb(c.env, c.get('workspaceId'));
  await db
    .prepare(
      'INSERT INTO skills (id, name, description, front_matter_json, markdown, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    )
    .bind(id, body.name, body.description, JSON.stringify(body.frontMatter), body.markdown, Date.now(), Date.now())
    .run();
  return c.json({ id, ...body }, 201);
});
