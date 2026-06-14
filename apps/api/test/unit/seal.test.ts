import { describe, it, expect } from 'vitest';
import { maskedKey } from '../../src/security/seal';

describe('maskedKey', () => {
  it('masks long keys', () => {
    expect(maskedKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
  });
  it('masks short keys as ****', () => {
    expect(maskedKey('short')).toBe('****');
  });
});
