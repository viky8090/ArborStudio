# ADR 0004: LLM API Keys Never Leave the Container

**Status:** Accepted · **Date:** 2026-06-14

## Context

Users will paste their OpenAI / Anthropic API keys into the UI. We must:

1. Encrypt at rest
2. Never leak in logs
3. Never put in a Worker `secret` (shared with the marketing page)
4. Never put in a Cloudflare Pages env var (public to the browser)
5. Minimize the surface area of the plaintext

Arbor's CLI writes them plaintext to `~/.arbor/config.yaml`. We must not copy this.

## Decision

**Envelope-encrypted in D1; decrypted only inside the Container at run start.**

```
KMS-style:
  KEK  = env.KEK (32-byte secret in the Worker secret store)
  DEK  = per-workspace random 32-byte key
  API  = the actual LLM API key

Storage:
  D1.workspace_deks  -> AES-GCM(KEK, DEK)        # wrapped DEK, never the KEK
  D1.project_secrets -> AES-GCM(DEK, API)        # ciphertext + nonce + dek_id

Flow at run start:
  Worker -> DEK = AES-GCM-decrypt(wrapped_dek, KEK)
  Worker -> API = AES-GCM-decrypt(ciphertext, DEK)
  Worker -> POST plaintext API to Container.start() over signed JWT channel
  Container -> env var to `arbor run` subprocess
  Container -> SIGTERM handler scrubs `/proc/<pid>/environ` and zero-fills
```

The Worker never sees the plaintext API key in steady state — only at the moment
of save (encrypt) and the moment of run start (decrypt for transfer to the Container).

## Consequences

**Positive:**
- Defense in depth: a D1 leak exposes ciphertext only.
- A Worker secret leak doesn't expose any user key.
- Per-workspace DEK rotation is a one-row update.
- A Cloudflare Pages env-var leak exposes nothing.

**Negative:**
- More code than "store plaintext in D1". ~150 LOC.
- KEK rotation requires re-wrapping all DEKs. Use a Cron Trigger for this.
- The Container is the trust boundary; if it's compromised, the key is exposed.
  Mitigated by the Container's network policy (allow-list PyPI + LLM providers only).

**Redaction middleware:** every log line scans for `sk-...`, `AKIA...`, `ghp_...`,
`xoxb-...`, `whsec_...`, JWT-style `Bearer eyJ...`, and JSON-style
`"api_key": "..."`. Replaced with `***REDACTED***` before the line leaves the
Worker or Container.

## References

- [PLAN.md §3.6, §11, §16.3](../../docs/ARCHITECTURE.md)
- [`apps/api/src/security/`](../../apps/api/src/security/)
