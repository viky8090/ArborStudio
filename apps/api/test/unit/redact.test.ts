import { describe, it, expect } from 'vitest';
import { redact } from '../../src/observability/redact';

describe('redact', () => {
  it('redacts OpenAI/Anthropic keys', () => {
    expect(redact('hello sk-1234567890abcdef1234 world')).toContain('REDACTED');
  });

  it('redacts AWS access keys', () => {
    expect(redact('AKIA1234567890ABCDEF')).toContain('REDACTED');
  });

  it('redacts GitHub PATs', () => {
    expect(redact('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toContain('REDACTED');
  });

  it('redacts Slack tokens', () => {
    expect(redact('xoxb-1234-5678-abcd')).toContain('REDACTED');
  });

  it('redacts JSON-style api_key values', () => {
    expect(redact('"api_key": "secret123"')).toContain('REDACTED');
  });

  it('leaves non-sensitive text alone', () => {
    expect(redact('just a normal log line')).toBe('just a normal log line');
  });
});
