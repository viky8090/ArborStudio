/**
 * WebSocket upgrade route for the RunDO.
 * The Worker entry delegates the WS upgrade to the per-run RunDO via fetch.
 *
 * We also expose a personal /ws for billing alerts, etc. (not implemented in Phase 0).
 */

import { Hono } from 'hono';
import type { Env } from '../index';

export const wsRoutes = new Hono<{ Bindings: Env }>();

wsRoutes.get('/runs/:rid/ws', async (c) => {
  const rid = c.req.param('rid');
  // Forward the request to the RunDO. The DO upgrades to WebSocket.
  const doId = c.env.RUN_DO.idFromName(rid);
  const stub = c.env.RUN_DO.get(doId);
  // Construct a new Request with the same headers/URL; the DO's acceptWebSocket
  // will perform the actual upgrade and return 101.
  const url = new URL(c.req.url);
  url.pathname = '/ws';
  return stub.fetch(
    new Request(url.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
    }),
  );
});
