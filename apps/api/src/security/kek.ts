/**
 * KEK (Key Encryption Key) and seal result types.
 *
 * Architecture:
 *   KEK = env.KEK (32 bytes, base64) — one per environment, never leaves the Worker secret store.
 *   DEK = per-workspace random 32 bytes — wraps the actual LLM API keys (and anything else sensitive).
 *   The DEK itself is stored encrypted in D1 (or KV cache) as workspace_deks.wrapped_dek.
 *
 * The Worker never sees the plaintext LLM API key in steady state — only the DEK
 * wrapping/unwrapping at save time and the Container receives the unwrapped key at run start.
 */

import type { Env } from '../index';

export function getKek(env: Env): Uint8Array {
  const b64 = env.KEK.replace(/^base64:/, '').trim();
  const bin = atob(b64);
  if (bin.length !== 32) {
    throw new Error(`KEK must be 32 bytes, got ${bin.length}. Generate with: openssl rand -base64 32`);
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SealResult {
  ciphertext: Uint8Array; // AES-GCM ciphertext
  nonce: Uint8Array; // 12-byte IV
  dekId: string; // identifies which DEK was used (for future rotation)
}
