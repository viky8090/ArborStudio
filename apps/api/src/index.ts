/**
 * ArborStudio API — Cloudflare Worker entry.
 *
 * The Worker is the API gateway:
 *   - HTTP REST at /api/v1/* (Hono router)
 *   - WebSocket at /api/v1/runs/:rid/ws (hands off to RunDO)
 *   - Internal /api/internal/* for the Container (mTLS / signed JWT)
 *   - /api/internal/container/start is the one route the Worker calls the Container on
 *
 * The heavy lifting lives in:
 *   - src/router.ts (Hono app)
 *   - src/durable-objects/run-do.ts (per-run WS hub, tree, event log)
 *   - src/durable-objects/workspace-do.ts (per-workspace rate limit, session cache)
 */

import { router } from './router';
import { RunDO } from './durable-objects/run-do';
import { WorkspaceDO } from './durable-objects/workspace-do';

// Re-export the Durable Object classes so Workers can find them by class_name.
export { RunDO, WorkspaceDO };

// The default export is the Hono app. We wrap it in a fetch handler to add
// request-id, tracing, and the Worker entry contract.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
    const start = Date.now();

    try {
      const response = await router.fetch(request, env, ctx);

      // Log every request to Workers Logs / Logpush
      console.log(
        JSON.stringify({
          level: 'info',
          ts: new Date().toISOString(),
          requestId,
          method: request.method,
          url: request.url,
          status: response.status,
          durationMs: Date.now() - start,
          cf: {
            ray: request.headers.get('cf-ray'),
            country: request.headers.get('cf-ipcountry'),
            colo: request.headers.get('cf-colo'),
          },
        }),
      );

      // Propagate the request id back to the client for debugging
      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          ts: new Date().toISOString(),
          requestId,
          err: (err as Error).message,
          stack: (err as Error).stack,
          method: request.method,
          url: request.url,
        }),
      );
      return new Response(
        JSON.stringify({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred.',
          requestId,
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/problem+json', 'x-request-id': requestId },
        },
      );
    }
  },

  // Cron Triggers: daily rollup, stale-run check, digests
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '0 2 * * *': // 02:00 UTC daily
        ctx.waitUntil(dailyRollup(env));
        break;
      case '*/15 * * * *': // every 15 min
        ctx.waitUntil(checkStaleRuns(env));
        break;
      case '0 8 * * *': // 08:00 UTC daily
        ctx.waitUntil(sendDailyDigests(env));
        break;
    }
  },

  // Queue consumer: events from the Container
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processEventBatch(batch, env));
  },
};

// ----- Cron/queue handlers (stubbed for Phase 0) -----

async function dailyRollup(_env: Env): Promise<void> {
  // TODO: read AI Gateway logs, write daily rollup into D1 usage_records
  // See PLAN.md §3.5
}

async function checkStaleRuns(_env: Env): Promise<void> {
  // TODO: find runs with last_heartbeat > 5 min ago, mark as stalled
  // See PLAN.md §16.2 #18
}

async function sendDailyDigests(_env: Env): Promise<void> {
  // TODO: email digests to workspace members
  // See PLAN.md §10
}

async function processEventBatch(batch: MessageBatch, _env: Env): Promise<void> {
  // TODO: forward each message to the appropriate RunDO via stub.appendEvent
  // See PLAN.md §5.2 / §16.2 #25
  batch.ackAll();
}

// ----- Env type -----

export interface Env {
  // Bindings (from wrangler.toml)
  RUN_DO: DurableObjectNamespace<RunDO>;
  WORKSPACE_DO: DurableObjectNamespace<WorkspaceDO>;
  DB_META: D1Database;
  DB_WS_DEFAULT: D1Database;
  ASSETS: R2Bucket;
  KV: KVNamespace;
  EVENTS_QUEUE: Queue<unknown>;
  EVENTS_DLQ: Queue<unknown>;
  AI: Ai;
  ANALYTICS: AnalyticsEngineDataset;

  // Vars (from wrangler.toml [vars])
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  TURNSTILE_SITE_KEY: string;
  DEFAULT_REGION: string;
  ALLOWED_ORIGINS: string;

  // Secrets (from wrangler secret put / .dev.vars)
  JWT_SECRET: string;
  KEK: string;
  TURNSTILE_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SENTRY_DSN?: string;
}
