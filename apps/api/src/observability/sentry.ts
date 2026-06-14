/**
 * Sentry initialization (optional).
 * Both the Worker and Pages have Sentry support.
 * DSNs are env vars; if absent, the no-op is a no-op.
 */

import type { Env } from '../index';

export function initSentry(_env: Env, _context: 'worker' | 'pages'): void {
  // TODO: dynamic import of @sentry/cloudflare when DSN is present
  // Phase 0: placeholder; production wires Sentry via @sentry/cloudflare in Worker entry
}
