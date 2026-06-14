/**
 * Auth routes.
 *   POST /auth/signup    email + password + turnstile -> JWT
 *   POST /auth/login     email + password + turnstile -> JWT
 *   POST /auth/refresh   refresh token -> new access JWT
 *   POST /auth/logout    invalidate refresh token
 *
 * Phase 0: uses the meta D1 database (DB_META) for users + sessions.
 * Production adds OAuth (Google, GitHub), email verification, password reset.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../index';
import { issueTokens, verifyRefreshToken, revokeRefreshToken, hashPassword, verifyPassword } from '../auth/jwt';
import { verifyTurnstile } from '../auth/turnstile';
import { HttpError } from '../errors';
import { newId } from '../lib/ulid';

const SignupBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(80).trim(),
  turnstileToken: z.string().min(1),
});

const LoginBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1),
});

const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/signup', async (c) => {
  const body = SignupBody.parse(await c.req.json());

  // 1. Verify Turnstile
  await verifyTurnstile(body.turnstileToken, c.env);

  // 2. Check user doesn't exist
  const existing = await c.env.DB_META.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email)
    .first<{ id: string }>();
  if (existing) {
    throw new HttpError(409, 'Conflict', 'An account with this email already exists.');
  }

  // 3. Create user + first workspace
  const userId = `u_${newId()}`;
  const workspaceId = `ws_${newId()}`;
  const passwordHash = await hashPassword(body.password);

  await c.env.DB_META.batch([
    c.env.DB_META
      .prepare(
        'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(userId, body.email, body.name, passwordHash, Date.now()),
    c.env.DB_META
      .prepare(
        'INSERT INTO workspaces (id, name, owner_id, plan, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(workspaceId, `${body.name}'s workspace`, userId, 'free', Date.now()),
    c.env.DB_META
      .prepare(
        'INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .bind(workspaceId, userId, 'owner', Date.now()),
  ]);

  // 4. Issue tokens
  const tokens = await issueTokens(userId, workspaceId, c.env);
  setAccessRefreshCookies(c, tokens.accessToken, tokens.refreshToken);

  return c.json(
    {
      user: { id: userId, email: body.email, name: body.name },
      workspace: { id: workspaceId, name: `${body.name}'s workspace` },
    },
    201,
  );
});

authRoutes.post('/login', async (c) => {
  const body = LoginBody.parse(await c.req.json());
  await verifyTurnstile(body.turnstileToken, c.env);

  const user = await c.env.DB_META.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?',
  )
    .bind(body.email)
    .first<{ id: string; email: string; name: string; password_hash: string }>();

  if (!user) {
    throw new HttpError(401, 'Unauthorized', 'Invalid email or password.');
  }
  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) {
    throw new HttpError(401, 'Unauthorized', 'Invalid email or password.');
  }

  // Find the user's primary workspace (first membership)
  const ws = await c.env.DB_META.prepare(
    'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
  )
    .bind(user.id)
    .first<{ workspace_id: string }>();
  if (!ws) {
    throw new HttpError(500, 'Internal Server Error', 'User has no workspace.');
  }

  const tokens = await issueTokens(user.id, ws.workspace_id, c.env);
  setAccessRefreshCookies(c, tokens.accessToken, tokens.refreshToken);

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    workspace: { id: ws.workspace_id },
  });
});

authRoutes.post('/refresh', async (c) => {
  const body = RefreshBody.parse(await c.req.json());
  const claims = await verifyRefreshToken(body.refreshToken, c.env);
  const tokens = await issueTokens(claims.sub, claims.wid, c.env);
  await revokeRefreshToken(body.refreshToken); // rotate
  setAccessRefreshCookies(c, tokens.accessToken, tokens.refreshToken);
  return c.json({ ok: true });
});

authRoutes.post('/logout', async (c) => {
  const refreshToken = getCookie(c, 'arbor_refresh');
  if (refreshToken) await revokeRefreshToken(refreshToken).catch(() => {});
  deleteCookie(c, 'arbor_access');
  deleteCookie(c, 'arbor_refresh');
  return c.json({ ok: true });
});

function setAccessRefreshCookies(
  c: { env: Env },
  accessToken: string,
  refreshToken: string,
) {
  const secure = c.env.ENVIRONMENT === 'production';
  setCookie(c as never, 'arbor_access', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 15, // 15 min
  } as never);
  setCookie(c as never, 'arbor_refresh', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/api/v1/auth',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  } as never);
}
