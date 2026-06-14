import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('concatenates truthy strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy values', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });
});
