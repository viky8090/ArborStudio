/**
 * Env helpers.
 */
import type { Env } from '../index';

export function region(env: Env): string {
  return env.DEFAULT_REGION;
}

export function isProd(env: Env): boolean {
  return env.ENVIRONMENT === 'production' || env.ENVIRONMENT === 'staging';
}
