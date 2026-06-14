/**
 * Internal routes — Container <-> Worker.
 *   POST /api/internal/container/start        Worker -> Container (initial handshake)
 *   GET  /api/internal/runs/:rid/command      Container long-polls
 *   POST /api/internal/runs/:rid/event        Container -> Worker (or Queue)
 *   POST /api/internal/runs/:rid/heartbeat    every 30s
 *   POST /api/internal/runs/:rid/tree-snapshot  R2 upload
 *   POST /api/internal/runs/:rid/finalize       run complete
 *
 * Auth: short-lived signed JWT issued at start, verified in middleware.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { verifyContainerJwt, type ContainerClaims } from '../../auth/container-jwt';
import { HttpError } from '../../errors';
import { newId } from '../../lib/ulid';

export const internalRoutes = new Hono<{ Bindings: Env; Variables: { containerClaims: ContainerClaims } }>();

// ----- Auth middleware for all /api/internal/* routes (except /start) -----
type InternalVars = { containerClaims: ContainerClaims };
internalRoutes.use('*', async (c, next) => {
  if (c.req.path.endsWith('/container/start')) return next();
  const auth = c.req.header('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw new HttpError(401, 'Unauthorized', 'Missing container JWT.');
  const claims = await verifyContainerJwt(token, c.env);
  c.set('containerClaims', claims);
  await next();
});

const StartBody = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  // (more fields in production)
});

internalRoutes.post('/container/start', async (c) => {
  // TODO: in production, the Worker calls the Container's HTTP endpoint
  // For Phase 0, this is the entry point. We return 202 to simulate a successful start.
  const body = StartBody.parse(await c.req.json());
  return c.json(
    {
      ok: true,
      runId: body.runId,
      sid: newId(),
      configYaml: '# placeholder\nplugin: builtin',
    },
    202,
  );
});

const CommandQuery = z.object({ wait: z.coerce.number().int().min(0).max(60).default(30) });

internalRoutes.get('/runs/:rid/command', async (c) => {
  const rid = c.req.param('rid');
  const wait = CommandQuery.parse(c.req.query()).wait;
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  const res = await stub.fetch(
    new Request(`https://run-do/command?wait=${wait}`, { method: 'GET' }),
  );
  return new Response(res.body, { status: res.status, headers: res.headers });
});

const EventBody = z.object({
  type: z.string(),
  payload: z.record(z.unknown()).default({}),
  seq: z.number().int().nonnegative().optional(),
});

internalRoutes.post('/runs/:rid/event', async (c) => {
  const rid = c.req.param('rid');
  const body = EventBody.parse(await c.req.json());
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  const res = await stub.fetch(
    new Request('https://run-do/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, ts: Date.now() }),
    }),
  );
  return new Response(res.body, { status: res.status, headers: res.headers });
});

internalRoutes.post('/runs/:rid/heartbeat', async (c) => {
  const rid = c.req.param('rid');
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  await stub.fetch(new Request('https://run-do/heartbeat', { method: 'POST' }));
  return c.json({ ok: true });
});

const SnapshotBody = z.object({
  cycle: z.number().int().nonnegative(),
  tree: z.record(z.unknown()),
});

internalRoutes.post('/runs/:rid/tree-snapshot', async (c) => {
  const rid = c.req.param('rid');
  const body = SnapshotBody.parse(await c.req.json());
  const key = `runs/${rid}/tree/cycle-${String(body.cycle).padStart(4, '0')}.json.gz`;
  const json = JSON.stringify(body.tree);
  // Phase 0: store as plain JSON; in production, gzip + content-encoding header
  await c.env.ASSETS.put(key, json, { httpMetadata: { contentType: 'application/json' } });
  return c.json({ ok: true, key });
});

internalRoutes.post('/runs/:rid/finalize', async (c) => {
  const rid = c.req.param('rid');
  const body = z.object({ report: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
  if (body.report) {
    await c.env.ASSETS.put(`runs/${rid}/report.md`, body.report, {
      httpMetadata: { contentType: 'text/markdown' },
    });
  }
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  await stub.fetch(new Request('https://run-do/finalize', { method: 'POST' }));
  return c.json({ ok: true });
});
