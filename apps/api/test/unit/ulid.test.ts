import { describe, it, expect } from 'vitest';
import { newId } from '../../src/lib/ulid';

describe('newId', () => {
  it('returns a 26-char ULID', () => {
    const id = newId();
    expect(id).toHaveLength(26);
  });
  it('returns unique values', () => {
    const ids = new Set([newId(), newId(), newId(), newId(), newId()]);
    expect(ids.size).toBe(5);
  });
});
