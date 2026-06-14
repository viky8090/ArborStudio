/**
 * ULID generator.
 * 26-char Crockford base32 string, lexicographically sortable by time.
 * https://github.com/ulid/spec
 */

import { ulid } from 'ulid';

export function newId(): string {
  return ulid();
}
