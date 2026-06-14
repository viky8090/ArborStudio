/**
 * Hono router for the ArborStudio API.
 *
 * Routes:
 *   GET  /healthz                          liveness
 *   GET  /readyz                           readiness (checks D1, R2, AI)
 *   /api/v1/auth/*                         signup, login, logout, refresh
 *   /api/v1/me                             current user
 *   /api/v1/workspaces/*                  list, create, switch
 *   /api/v1/workspaces/:wid/projects/*     list, create, get
 *   /api/v1/projects/:pid/runs/*          list, create, get, pause, resume, cancel
 *   /api/v1/runs/:rid/ws                  WebSocket upgrade -> RunDO
 *   /api/v1/runs/:rid/tree                full tree (DO RPC)
 *   /api/v1/plugins/*                     list, create, get, test
 *   /api/v1/skills/*                      list, create, get
 *   /api/v1/integrations/*                list, create
 *   /api/v1/me/llm-keys                   list, set, delete
 *   /api/v1/billing/*                     usage, invoices, stripe-portal, webhook
 *   /api/internal/*                       Container <-> Worker (signed JWT)
 *   /api/internal/container/start         Worker -> Container (initial handshake)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './index';

import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { workspaceRoutes } from './routes/workspaces';
import { projectRoutes } from './routes/projects';
import { runRoutes } from './routes/runs';
import { pluginRoutes } from './routes/plugins';
import { skillRoutes } from './routes/skills';
import { llmKeyRoutes } from './routes/llm-keys';
import { billingRoutes } from './routes/billing';
import { internalRoutes } from './routes/internal';
import { wsRoutes } from './ws/runs';
import { problemJson } from './errors';

const app = new Hono<{ Bindings: Env }>();

// ----- Global middleware -----
app.use('*', logger());
app.use('*', secureHeaders());

// CORS: dynamic origin allowlist from env
app.use('*', async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return cors({
    origin: (origin) => (origin && allowed.includes(origin) ? origin : allowed[0]),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization', 'x-turnstile-token', 'x-idempotency-key'],
    maxAge: 86400,
  })(c, next);
});

// ----- Health & readiness -----
app.route('/healthz', healthRoutes);
app.route('/readyz', healthRoutes);

// ----- Versioned API -----
const v1 = new Hono<{ Bindings: Env }>();
v1.route('/auth', authRoutes);
v1.route('/me', meRoutes);
v1.route('/workspaces', workspaceRoutes);
v1.route('/projects', projectRoutes);
v1.route('/projects/:pid/runs', runRoutes);
v1.route('/plugins', pluginRoutes);
v1.route('/skills', skillRoutes);
v1.route('/llm-keys', llmKeyRoutes);
v1.route('/billing', billingRoutes);
app.route('/api/v1', v1);

// ----- Internal (Container <-> Worker) -----
app.route('/api/internal', internalRoutes);

// ----- WebSocket -----
app.route('/api/v1', wsRoutes);

// ----- 404 -----
app.notFound((c) =>
  c.json(
    {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: `No route for ${c.req.method} ${c.req.path}`,
    },
    404,
  ),
);

// ----- 500 / error handler -----
import { ZodError } from 'zod';

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  if (err instanceof ZodError) {
    return c.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid request body.',
        errors: err.errors,
      },
      400,
    );
  }
  return c.json(problemJson(500, 'Internal Server Error', err.message), 500);
});

export const router = app;
