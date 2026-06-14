/**
 * Typed API client.
 * In Phase 1, this will use Hono's `hc<AppType>` for end-to-end type safety
 * with the Worker's router. For now, fetch + Zod.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8787';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://127.0.0.1:8787';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => '')) as string;
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export function wsUrl(path: string): string {
  return `${WS_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`API ${status}: ${body.slice(0, 200)}`);
  }
}
