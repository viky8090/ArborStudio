# ADR 0005: AI Gateway as the LLM Frontend

**Status:** Accepted · **Date:** 2026-06-14

## Context

We make LLM calls in three places:
1. The Worker (warmup, classification, AI-assisted skill generation)
2. The Container's `arbor run` subprocess (Coordinator + Executor calls)
3. The Container's local `cost guard` (queries running cost)

We need unified observability, caching, fallback, and cost attribution. Options:
- **A.** Cloudflare AI Gateway (managed proxy in front of any LLM SDK)
- **B.** Self-hosted LiteLLM proxy
- **C.** Direct SDK calls + a separate observability tool (Langfuse, Helicone)

## Decision

**Adopt Option A** (Cloudflare AI Gateway). All LLM calls in the Worker go
through `env.AI.run()`. The Container configures its LLM clients with the
Gateway's base URL and a per-workspace gateway key.

AI Gateway provides:
- Unified logging (tokens, cost, latency, model, prompt/completion retention)
- Caching (5-min TTL on identical prompts)
- Fallback (primary → secondary on 5xx or 5s timeout)
- Rate limits per provider / per model
- Cost attribution per request (rolled up into D1 `usage_records` by a daily Cron)

The raw AI Gateway logs are mirrored to R2 (`aigw-logs/<yyyy>/<mm>/<dd>/`) for
forensics beyond the dashboard's 30-day window.

## Consequences

**Positive:**
- One IAM, one bill, one dashboard for LLM observability.
- Caching saves real money on identical skill prompts.
- Fallback avoids single-vendor outages.
- Per-workspace rate limits are native; no custom code.

**Negative:**
- AI Gateway is a proxy, not a feature. We still need to call the LLM SDK
  through the gateway's base URL.
- Latency: one extra hop (~10ms p99).
- The Container is configured with a per-workspace gateway key; the key itself
  is stored encrypted (see ADR 0004) and decrypted at run start.

## References

- [PLAN.md §3.5, §12, §14.2](../../docs/ARCHITECTURE.md)
- [AI Gateway docs](https://developers.cloudflare.com/ai-gateway)
- [`apps/api/src/ai/gateway.ts`](../../apps/api/src/ai/gateway.ts)
