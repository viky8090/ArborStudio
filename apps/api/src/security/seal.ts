/**
 * High-level seal/open for LLM API keys.
 * Per-workspace DEK, AES-GCM, base64url-safe wire format.
 */

import type { Env } from '../index';
import { getOrCreateWorkspaceDek, aesGcmEncrypt, aesGcmDecrypt } from './dek';

export interface SealedKey {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  dekId: string;
}

export async function encryptForWorkspace(
  workspaceId: string,
  plaintext: string,
  env: Env,
): Promise<SealedKey> {
  const { dek, dekId } = await getOrCreateWorkspaceDek(workspaceId, env);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await aesGcmEncrypt(new TextEncoder().encode(plaintext), nonce, dek);
  return { ciphertext, nonce, dekId };
}

export async function decryptForWorkspace(workspaceId: string, sealed: SealedKey, env: Env): Promise<string> {
  const { dek } = await getOrCreateWorkspaceDek(workspaceId, env);
  const pt = await aesGcmDecrypt(sealed.ciphertext, sealed.nonce, dek);
  return new TextDecoder().decode(pt);
}

export function maskedKey(key: string): string {
  if (key.length < 12) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
