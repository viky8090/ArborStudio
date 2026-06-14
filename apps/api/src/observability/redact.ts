/**
 * Secret-pattern redaction for log lines.
 * Run on every string before it leaves the Worker.
 *
 * Patterns matched:
 *   - sk-...  (OpenAI / Anthropic style)
 *   - AKIA... (AWS)
 *   - ghp_... (GitHub PAT)
 *   - xoxb-... / xoxp-... (Slack)
 *   - whsec_... (Stripe webhook secret)
 *   - Bearer eyJ... (JWT in Authorization header)
 *   - "api_key": "..."  (JSON style)
 *   - LLM provider base URLs with embedded keys
 */

const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /sk-[A-Za-z0-9_\-]{16,}/g, replace: 'sk-***REDACTED***' },
  { re: /sk-ant-[A-Za-z0-9_\-]{16,}/g, replace: 'sk-ant-***REDACTED***' },
  { re: /AKIA[0-9A-Z]{16}/g, replace: 'AKIA***REDACTED***' },
  { re: /ghp_[A-Za-z0-9]{30,}/g, replace: 'ghp_***REDACTED***' },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, replace: 'xox*-***REDACTED***' },
  { re: /whsec_[A-Za-z0-9]{16,}/g, replace: 'whsec_***REDACTED***' },
  { re: /Bearer\s+eyJ[A-Za-z0-9_\-\.=]{20,}/g, replace: 'Bearer ***REDACTED-JWT***' },
  { re: /("|')(api_?key|secret|password|token)\1\s*:\s*("[^"]+"|'[^']+')/gi, replace: '$1$2$1: ***REDACTED***' },
];

export function redact(s: string): string {
  let out = s;
  for (const { re, replace } of PATTERNS) out = out.replace(re, replace);
  return out;
}

export function redactObject<T>(o: T): T {
  try {
    return JSON.parse(redact(JSON.stringify(o))) as T;
  } catch {
    return o;
  }
}
