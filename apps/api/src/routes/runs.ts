/**
 * Run routes.
 *   GET    /projects/:pid/runs                   list runs
 *   POST   /projects/:pid/runs                   launch a run (returns 202 with ws_url)
 *   GET    /projects/:pid/runs/:rid              detail
 *   POST   /projects/:pid/runs/:rid/pause        flip DO flag
 *   POST   /projects/:pid/runs/:rid/resume
 *   POST   /projects/:pid/runs/:rid/cancel
 *   POST   /projects/:pid/runs/:rid/steer        free-text guidance
 *   GET    /projects/:pid/runs/:rid/tree         full tree via DO RPC
 *   GET    /projects/:pid/runs/:rid/events       paginated event log
 *
 * The Worker:
 *   1. Creates a D1 runs row
 *   2. Instantiates a RunDO (named `run:<rid>`)
 *   3. Calls Container.start() (or enqueues a start task)
 *   4. Returns the WS URL
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { HttpError } from '../errors';
import { newId } from '../lib/ulid';
import { workspaceDb } from '../db/d1';

export const runRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

runRoutes.use('*', requireAuth);

runRoutes.get('/', async (c) => {
  const pid = c.req.param('pid')!;
  const wid = c.req.query('workspaceId') ?? c.get('workspaceId');
  const db = workspaceDb(c.env, wid);
  const rows = await db
    .prepare(
      `SELECT id, workspace_id, project_id, name, status, mode, max_cycles, max_turns,
              spent_usd, started_at, ended_at, created_at
       FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 100`,
    )
    .bind(pid)
    .all();
  return c.json({ runs: rows.results });
});

const LaunchBody = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1).max(120).trim().default('Untitled run'),
  goal: z.string().min(1).max(2000),
  mode: z.enum(['auto', 'review', 'steer']).default('auto'),
  maxCycles: z.number().int().min(1).max(500).default(20),
  maxTurns: z.number().int().min(1).max(1000).default(100),
  plugin: z.string().optional(),
  pluginProfile: z.string().optional(),
  skills: z.array(z.string()).default([]),
  reasoningEffort: z.enum(['low', 'medium', 'high']).default('medium'),
  model: z.string().default('claude-sonnet-4-5'),
  budgetUsd: z.number().positive().max(10000).optional(),
  configYaml: z.string().optional(),
});

runRoutes.post('/', async (c) => {
  const pid = c.req.param('pid')!;
  const body = LaunchBody.parse(await c.req.json());
  const wid = body.workspaceId ?? c.get('workspaceId');
  const rid = `r_${newId()}`;
  const now = Date.now();
  const db = workspaceDb(c.env, wid);

  await db
    .prepare(
      `INSERT INTO runs (id, workspace_id, project_id, name, status, mode, max_cycles, max_turns,
         plugin, plugin_profile, skills, reasoning_effort, model, budget_usd,
         do_id, ws_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      rid,
      wid,
      pid,
      body.name,
      'starting', // status
      body.mode,
      body.maxCycles,
      body.maxTurns,
      body.plugin ?? null,
      body.pluginProfile ?? null,
      JSON.stringify(body.skills),
      body.reasoningEffort,
      body.model,
      body.budgetUsd ?? null,
      rid, // DO id == rid
      `wss://api.arborstudio.workers.dev/api/v1/runs/${rid}/ws`,
      c.get('userId'),
      now,
      now,
    )
    .run();

  // Hand off to the RunDO. It will start the Container and stream events.
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  await stub.fetch(
    new Request('https://run-do/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        runId: rid,
        projectId: pid,
        workspaceId: wid,
        goal: body.goal,
        mode: body.mode,
        maxCycles: body.maxCycles,
        maxTurns: body.maxTurns,
        plugin: body.plugin,
        configYaml: body.configYaml,
      }),
    }),
  );

  return c.json(
    {
      id: rid,
      status: 'starting',
      wsUrl: `wss://api.arborstudio.workers.dev/api/v1/runs/${rid}/ws`,
    },
    202,
  );
});

runRoutes.get('/:rid', async (c) => {
  const rid = c.req.param('rid')!;
  const wid = c.req.query('workspaceId') ?? c.get('workspaceId');
  const db = workspaceDb(c.env, wid);
  const row = await db.prepare('SELECT * FROM runs WHERE id = ?').bind(rid).first();
  if (!row) throw new HttpError(404, 'Not Found');
  return c.json(row);
});

const FlagBody = z.object({}).optional();

runRoutes.post('/:rid/pause', async (c) => {
  const rid = c.req.param('rid')!;
  FlagBody.parse(await c.req.json().catch(() => ({})));
  const doId = c.env.RUN_DO.idFromName(rid);
  await c.env.RUN_DO.get(doId).fetch(new Request('https://run-do/flag/pause', { method: 'POST' }));
  return c.json({ ok: true });
});

runRoutes.post('/:rid/resume', async (c) => {
  const rid = c.req.param('rid')!;
  const doId = c.env.RUN_DO.idFromName(rid);
  await c.env.RUN_DO.get(doId).fetch(new Request('https://run-do/flag/resume', { method: 'POST' }));
  return c.json({ ok: true });
});

runRoutes.post('/:rid/cancel', async (c) => {
  const rid = c.req.param('rid')!;
  const doId = c.env.RUN_DO.idFromName(rid);
  await c.env.RUN_DO.get(doId).fetch(new Request('https://run-do/flag/cancel', { method: 'POST' }));
  return c.json({ ok: true });
});

const SteerBody = z.object({ text: z.string().min(1).max(2000) });
runRoutes.post('/:rid/steer', async (c) => {
  const rid = c.req.param('rid')!;
  const body = SteerBody.parse(await c.req.json());
  const doId = c.env.RUN_DO.idFromName(rid);
  await c.env.RUN_DO.get(doId).fetch(
    new Request('https://run-do/flag/steer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return c.json({ ok: true });
});

runRoutes.get('/:rid/tree', async (c) => {
  const rid = c.req.param('rid')!;
  const doId = c.env.RUN_DO.idFromName(rid);
  const res = await c.env.RUN_DO.get(doId).fetch(new Request('https://run-do/tree'));
  return new Response(res.body, { status: res.status, headers: res.headers });
});

runRoutes.get('/:rid/events', async (c) => {
  const rid = c.req.param('rid')!;
  const since = Number(c.req.query('since') ?? 0);
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 1000);
  const doId = c.env.RUN_DO.idFromName(rid);
  const res = await c.env.RUN_DO.get(doId).fetch(
    new Request(`https://run-do/events?since=${since}&limit=${limit}`),
  );
  return new Response(res.body, { status: res.status, headers: res.headers });
});
