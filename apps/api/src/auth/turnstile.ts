/**
 * Cloudflare Turnstile verification.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import type { Env } from '../index';
import { HttpError } from '../errors';

export async function verifyTurnstile(token: string, env: Env): Promise<void> {
  if (!env.TURNSTILE_SECRET) return; // not configured in dev; skip
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
  });
  if (!res.ok) throw new HttpError(400, 'Bad Request', 'Turnstile verification failed.');
  const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
  if (!data.success) {
    throw new HttpError(400, 'Bad Request', `Turnstile rejected: ${data['error-codes']?.join(', ') ?? 'unknown'}`);
  }
}
