/**
 * DEK (per-workspace Data Encryption Key) storage.
 * Each workspace has one DEK, randomly generated on first use, wrapped by the master KEK.
 * The wrapped DEK is stored in D1's workspace_deks table; the unwrapped DEK lives in memory only.
 */

import type { Env } from '../index';
import { getKek } from './kek';

const WRAP_IV_BYTES = 12;

export async function getOrCreateWorkspaceDek(workspaceId: string, env: Env): Promise<{ dek: Uint8Array; dekId: string }> {
  // Look up existing
  const existing = await env.DB_META.prepare(
    'SELECT id, wrapped_dek, wrap_nonce FROM workspace_deks WHERE workspace_id = ?',
  )
    .bind(workspaceId)
    .first<{ id: string; wrapped_dek: Uint8Array; wrap_nonce: Uint8Array }>();
  if (existing) {
    const dek = await aesGcmDecrypt(new Uint8Array(existing.wrapped_dek), new Uint8Array(existing.wrap_nonce), getKek(env));
    return { dek, dekId: existing.id };
  }
  // Generate new
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const dekId = `dek_${crypto.randomUUID()}`;
  const iv = crypto.getRandomValues(new Uint8Array(WRAP_IV_BYTES));
  const wrapped = await aesGcmEncrypt(dek, iv, getKek(env));
  await env.DB_META.prepare(
    'INSERT INTO workspace_deks (id, workspace_id, wrapped_dek, wrap_nonce, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(dekId, workspaceId, wrapped, iv, Date.now())
    .run();
  return { dek, dekId };
}

export async function getWorkspaceDek(workspaceId: string, env: Env): Promise<{ dek: Uint8Array; dekId: string } | null> {
  const existing = await env.DB_META.prepare(
    'SELECT id, wrapped_dek, wrap_nonce FROM workspace_deks WHERE workspace_id = ?',
  )
    .bind(workspaceId)
    .first<{ id: string; wrapped_dek: Uint8Array; wrap_nonce: Uint8Array }>();
  if (!existing) return null;
  const dek = await aesGcmDecrypt(
    new Uint8Array(existing.wrapped_dek),
    new Uint8Array(existing.wrap_nonce),
    getKek(env),
  );
  return { dek, dekId: existing.id };
}

export async function putWorkspaceDek(workspaceId: string, _env: Env): Promise<void> {
  // Alias for symmetry with getWorkspaceDek; the real write is in getOrCreateWorkspaceDek.
}

// ----- AES-GCM helpers -----

export async function aesGcmEncrypt(plaintext: Uint8Array, iv: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
  return new Uint8Array(ct);
}

export async function aesGcmDecrypt(ciphertext: Uint8Array, iv: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new Uint8Array(pt);
}
