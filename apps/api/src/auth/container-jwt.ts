/**
 * Separate JWT issuer/verifier for the Cloudflare Container.
 * Distinct from `jwt.ts` (user JWTs) so a compromised container token can't impersonate a user.
 *
 * Container JWT claims: { runId, workspaceId, projectId, sid, scope: ['container'] }
 * Issued by the Worker at Container start; verified on every internal route.
 * Short TTL (15 min); Container long-polls for rotation.
 */

import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../index';

const CONTAINER_TTL_SEC = 60 * 15;

function secret(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET + ':container');
}

export interface ContainerClaims {
  runId: string;
  workspaceId: string;
  projectId: string;
  sid: string;
  scope: 'container';
}

export async function issueContainerJwt(claims: Omit<ContainerClaims, 'scope'>, env: Env): Promise<string> {
  return new SignJWT({ ...claims, scope: 'container' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.JWT_ISSUER + ':container')
    .setAudience(env.JWT_AUDIENCE + ':container')
    .setIssuedAt()
    .setExpirationTime(`${CONTAINER_TTL_SEC}s`)
    .sign(secret(env));
}

export async function verifyContainerJwt(token: string, env: Env): Promise<ContainerClaims> {
  const { payload } = await jwtVerify(token, secret(env), {
    issuer: env.JWT_ISSUER + ':container',
    audience: env.JWT_AUDIENCE + ':container',
  });
  if (payload.scope !== 'container') throw new Error('Wrong scope.');
  return {
    runId: payload.runId as string,
    workspaceId: payload.workspaceId as string,
    projectId: payload.projectId as string,
    sid: payload.sid as string,
    scope: 'container',
  };
}
