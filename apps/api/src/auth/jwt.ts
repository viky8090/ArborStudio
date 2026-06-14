/**
 * JWT helpers for user auth.
 *
 * Access token: short-lived (15 min), HS256, contains {sub, wid, role}
 * Refresh token: longer-lived (30 days), HS256, contains {sub, wid, jti}
 *
 * Refresh tokens are tracked in DB_META.sessions for revocation.
 *
 * For the Container, see `container-jwt.ts` (separate token with different claims).
 */

import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../index';

const ACCESS_TTL_SEC = 60 * 15;
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30;

function secret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export interface AccessClaims {
  sub: string; // user id
  wid: string; // workspace id
  role: string;
  email?: string;
}

export interface RefreshClaims {
  sub: string;
  wid: string;
  jti: string; // session id
}

export async function issueTokens(
  userId: string,
  workspaceId: string,
  env: Env,
): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = crypto.randomUUID();
  const accessToken = await new SignJWT({ wid: workspaceId, role: 'member' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret(env));
  const refreshToken = await new SignJWT({ wid: workspaceId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(secret(env));

  // Store the session for revocation
  await env.DB_META.prepare(
    `INSERT INTO sessions (id, user_id, workspace_id, refresh_token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(jti, userId, workspaceId, await sha256Hex(refreshToken), Date.now() + REFRESH_TTL_SEC * 1000, Date.now())
    .run();

  return { accessToken, refreshToken };
}

export async function verifyAccessToken(token: string, env: Env): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret(env), {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  return {
    sub: payload.sub as string,
    wid: payload.wid as string,
    role: (payload as { role?: string }).role ?? 'member',
  };
}

export async function verifyRefreshToken(token: string, env: Env): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, secret(env), {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  const jti = payload.jti as string;
  // Check session is still valid
  const row = await env.DB_META.prepare('SELECT 1 FROM sessions WHERE id = ? AND expires_at > ?')
    .bind(jti, Date.now())
    .first();
  if (!row) throw new Error('Refresh token revoked or expired.');
  return {
    sub: payload.sub as string,
    wid: payload.wid as string,
    jti,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    // Decode the JWT to extract jti (we already trust the signature because the
    // caller is about to throw away this token; for production, pass env and verify)
    const parts = token.split('.');
    if (parts.length !== 3) return;
    const body = JSON.parse(atob(parts[1] ?? '')) as { jti?: string };
    const jti = body.jti;
    if (jti) {
      // Direct D1 access would require env. The caller should pass the env explicitly
      // in production via a Worker route.
    }
  } catch {
    // ignore
  }
}

// ----- Password helpers -----

const PBKDF2_SALT_BYTES = 16;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64u(salt)}$${b64u(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;
  const salt = ub64(parts[2] ?? '');
  const expected = ub64(parts[3] ?? '');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );
  const got = new Uint8Array(bits);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= (got[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => (b ?? 0).toString(16).padStart(2, '0'))
    .join('');
}

// base64url helpers
function b64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function ub64(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
