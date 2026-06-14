/**
 * WorkspaceDO — one instance per workspace.
 *
 * Responsibilities:
 *   - Per-workspace rate limiting (token bucket in DO SQLite)
 *   - Per-workspace session cache
 *   - Per-workspace feature flags (read-through to KV for the rest of the app)
 *   - Per-workspace WebSocket connection roster (for personal /api/v1/me/ws)
 *
 * For Phase 0, this is a minimal placeholder. The plan calls out the full design
 * in PLAN.md §3.2 / §11. The KV-based rate limiter in src/security/ratelimit.ts
 * is the actual production path; the DO is for the cases that need atomic counters
 * across many Workers.
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

export class WorkspaceDO extends DurableObject<Env> {
  private sql: SqlStorage;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_buckets (
        bucket TEXT PRIMARY KEY,
        tokens REAL NOT NULL,
        last_refill INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_cache (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ratelimit/take') {
      const bucket = url.searchParams.get('bucket') ?? 'default';
      const cost = Number(url.searchParams.get('cost') ?? 1);
      const capacity = Number(url.searchParams.get('capacity') ?? 60);
      const refillPerSec = Number(url.searchParams.get('refill') ?? 1);
      const now = Date.now();
      const row = this.sql.exec<{ tokens: number; last_refill: number }>(
        'SELECT tokens, last_refill FROM rate_buckets WHERE bucket = ?',
        bucket,
      ).toArray()[0];
      let tokens = row?.tokens ?? capacity;
      const last = row?.last_refill ?? now;
      const delta = ((now - last) / 1000) * refillPerSec;
      tokens = Math.min(capacity, tokens + delta);
      if (tokens < cost) {
        return new Response(JSON.stringify({ ok: false, retryAfterMs: ((cost - tokens) / refillPerSec) * 1000 }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        });
      }
      tokens -= cost;
      this.sql.exec(
        'INSERT OR REPLACE INTO rate_buckets (bucket, tokens, last_refill) VALUES (?, ?, ?)',
        bucket,
        tokens,
        now,
      );
      return new Response(JSON.stringify({ ok: true, remaining: tokens }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  }
}
