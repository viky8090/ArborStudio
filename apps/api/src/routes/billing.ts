/**
 * Billing routes.
 *   GET  /billing/usage?from=&to=        daily rollup
 *   GET  /billing/invoices
 *   POST /billing/stripe-portal          returns Stripe Customer Portal URL
 *   POST /billing/webhook                Stripe -> Worker (no auth, signature-verified)
 *
 * Phase 0: stubs; Phase 5 wires Stripe + Cron-triggered daily rollup.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { requireAuth } from '../auth/middleware';
import { workspaceDb } from '../db/d1';

export const billingRoutes = new Hono<{
  Bindings: Env;
  Variables: { userId: string; workspaceId: string; role: string };
}>();

billingRoutes.use('*', requireAuth);

billingRoutes.get('/usage', async (c) => {
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const rows = await db
    .prepare(
      `SELECT day, model, agent, SUM(tokens_in) AS tokens_in, SUM(tokens_out) AS tokens_out,
              SUM(cost_usd) AS cost_usd, SUM(call_count) AS call_count
       FROM usage_records
       WHERE workspace_id = ?
       GROUP BY day, model, agent
       ORDER BY day DESC
       LIMIT 90`,
    )
    .bind(c.get('workspaceId'))
    .all();
  return c.json({ usage: rows.results });
});

billingRoutes.get('/invoices', async (c) => {
  const db = workspaceDb(c.env, c.get('workspaceId'));
  const rows = await db
    .prepare('SELECT * FROM invoices WHERE workspace_id = ? ORDER BY period_start DESC LIMIT 24')
    .bind(c.get('workspaceId'))
    .all();
  return c.json({ invoices: rows.results });
});

billingRoutes.post('/stripe-portal', async (c) => {
  // TODO: return Stripe.billingPortal.sessions.create URL
  return c.json({ ok: true, url: 'https://billing.stripe.com/p/login/test' });
});

billingRoutes.post('/webhook', async (c) => {
  // TODO: verify Stripe signature with c.env.STRIPE_WEBHOOK_SECRET, route events
  return c.json({ ok: true });
});
