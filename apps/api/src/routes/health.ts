/**
 * Health & readiness routes.
 *   GET /healthz  - liveness; always 200
 *   GET /readyz   - readiness; 200 only if D1, R2, AI are reachable
 */

import { Hono } from 'hono';
import type { Env } from '../index';

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get('/', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }));

export const readyzRoutes = new Hono<{ Bindings: Env }>();

readyzRoutes.get('/', async (c) => {
  const checks: Record<string, { ok: boolean; detail?: string; ms: number }> = {};
  const start = Date.now();

  // D1
  try {
    const t0 = Date.now();
    await c.env.DB_META.prepare('SELECT 1 as ok').first();
    checks.d1 = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    checks.d1 = { ok: false, detail: (e as Error).message, ms: 0 };
  }

  // R2
  try {
    const t0 = Date.now();
    // List with limit 0 to avoid fetching objects, just verifies auth
    await c.env.ASSETS.list({ limit: 0 });
    checks.r2 = { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    checks.r2 = { ok: false, detail: (e as Error).message, ms: 0 };
  }

  // AI Gateway (just checks the binding is present; real call would be expensive)
  checks.ai_gateway = { ok: typeof c.env.AI !== 'undefined', ms: 0 };

  const allOk = Object.values(checks).every((c) => c.ok);
  return c.json(
    {
      status: allOk ? 'ok' : 'degraded',
      ts: new Date().toISOString(),
      durationMs: Date.now() - start,
      checks,
    },
    allOk ? 200 : 503,
  );
});
