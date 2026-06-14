# ADR 0006: Cloudflare Pages + OpenNext, Not Vercel

**Status:** Accepted · **Date:** 2026-06-14

## Context

We need a Next.js 14 App Router app deployed to Cloudflare. Options:
- **A.** Vercel (the default for Next.js; excellent DX)
- **B.** Cloudflare Pages + the OpenNext Cloudflare adapter (mature as of 2025)
- **C.** Cloudflare Workers + a Next.js standalone build served by `wrangler`

## Decision

**Adopt Option B.** Pages + OpenNext. Concretely:

- Edge-rendered marketing pages, login, signup.
- Dashboard pages hydrated client-side with the live WebSocket feed.
- API routes that need Node APIs are migrated to the Worker API at
  `api.<your-domain>/api/v1/...`.
- The Pages project and the Worker live in the same `wrangler.toml` and share
  the same KV/D1/R2/DO bindings (Pages reads only; the Worker is the writer).

## Consequences

**Positive:**
- 100% Cloudflare (matches the rest of the stack).
- Pages + Workers = one vendor, one IAM, one bill.
- Cloudflare's edge network puts the UI within ~50ms of 95% of users.
- Pages' preview deploys per-PR are free.

**Negative:**
- OpenNext feature matrix lags Vercel. Check the
  [OpenNext Cloudflare adapter docs](https://opennext.js.org/cloudflare) before
  committing to a feature (streaming SSR, partial prerendering, some Next 14
  dynamic features).
- We have to write a small R2-backed `Image` loader; `next/image` doesn't have
  a built-in Cloudflare adapter yet.

**Fallback:** if a critical Next feature is missing, fall back to plain
`wrangler` with a Next.js standalone build + `serve` from the Worker. The
deployment story is the same.

## References

- [PLAN.md §3.7](../../docs/ARCHITECTURE.md)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Pages](https://developers.cloudflare.com/pages)
