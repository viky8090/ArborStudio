/**
 * Hono auth middleware.
 *
 * requireAuth: reads JWT from arbor_access cookie OR Authorization: Bearer header,
 * verifies it, and sets ctx.userId, ctx.workspaceId, ctx.role.
 *
 * requireRole: after requireAuth, asserts the user has one of the given roles
 * in the workspace passed in c.req.param('wid') or the default workspace.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env } from '../index';
import { verifyAccessToken } from './jwt';
import { HttpError } from '../errors';

type AuthVars = { userId: string; workspaceId: string; role: string };

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AuthVars }> = async (c, next) => {
  const auth = c.req.header('authorization');
  const cookieToken = getCookie(c, 'arbor_access');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : cookieToken;
  if (!token) throw new HttpError(401, 'Unauthorized', 'Missing access token.');

  try {
    const claims = await verifyAccessToken(token, c.env);
    c.set('userId', claims.sub);
    c.set('workspaceId', claims.wid);
    c.set('role', claims.role);
  } catch (e) {
    throw new HttpError(401, 'Unauthorized', (e as Error).message);
  }
  await next();
};

export async function requireRole(
  c: Context<{ Bindings: Env; Variables: AuthVars }>,
  wid: string,
  allowed: string[],
): Promise<void> {
  if (wid !== c.get('workspaceId')) {
    // The user is operating on a workspace other than their default; verify membership.
    const m = await c.env.DB_META.prepare(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    )
      .bind(wid, c.get('userId'))
      .first<{ role: string }>();
    if (!m) throw new HttpError(403, 'Forbidden', 'Not a member of this workspace.');
    c.set('workspaceId', wid);
    c.set('role', m.role);
  }
  if (!allowed.includes(c.get('role'))) {
    throw new HttpError(403, 'Forbidden', `Required role: one of ${allowed.join(', ')}.`);
  }
}
