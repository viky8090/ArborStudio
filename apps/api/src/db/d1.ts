/**
 * D1 binding resolver.
 *
 * In production, each workspace has its own D1 database named `ws_<wid>`.
 * Binding names are dynamic; the Worker can't statically know them all,
 * so we use a single "default" binding in dev and resolve per-workspace in prod
 * via the Cloudflare REST API.
 *
 * For now: every workspace shares DB_WS_DEFAULT. The schema is identical, so
 * multi-tenancy comes from the workspace_id column in every table.
 */

import type { Env } from '../index';

export function workspaceDb(env: Env, _workspaceId: string): D1Database {
  // TODO: in production, resolve to env[`DB_WS_${workspaceId.toUpperCase()}`] or
  // look up the dynamic binding name from KV.
  return env.DB_WS_DEFAULT;
}
