# ADR 0001: Run Arbor in a Cloudflare Container, not a Worker

**Status:** Accepted · **Date:** 2026-06-14

## Context

Arbor is a 100% Python framework (CLI + library) that runs long-lived research loops.
Cloudflare Workers run V8 / JS / TS only — Python is not supported in Workers.

We need to expose Arbor to a web app. There are exactly three options:

| Option | Approach | Verdict |
|---|---|---|
| A | Run Arbor in a Cloudflare Container (Docker), one per active run | Production path |
| B | Run Arbor on Fly.io / Railway / your own VPS | Pragmatic fallback |
| C | Re-implement Arbor in TypeScript | A year of work; not viable for v1 |

## Decision

**Adopt Option A.** Each active run is a Cloudflare Container that runs the full
Arbor Python runtime in a Docker image (`apps/container/`). The Cloudflare Worker
(`apps/api/`) is the API gateway and never runs Python.

The Container is a **one-process-per-run** image: it does not serve HTTP to the
public, only to the Worker's signed poll endpoint.

## Consequences

**Positive:**
- 100% Cloudflare — one vendor, one IAM, one bill.
- Full Python, full Arbor — no re-implementation.
- True multi-tenant isolation (one Container = one run = one user/project).
- Per-Container CPU/memory caps are a built-in cost guard.
- Git worktree isolation still works inside the Container (Arbor's existing model).

**Negative:**
- Container cold start is 3-8s. Mitigated with a "Starting…" UI animation.
- Container idle timeout must be tuned per run; kill anything idle > 30 min.
- Per-Container billing can be expensive for long runs; mitigated by `--max-cycles` and a USD cap.
- Cloudflare Containers were GA in 2025; the APIs may shift in the first year.

**Failure mode:** If Cloudflare Containers prove unstable in the first 90 days, fall back to
Option B (Fly.io machines) with the same Worker code. The Container entrypoint is reusable.

## References

- [PLAN.md §0, §3.1](../../docs/ARCHITECTURE.md)
- [Cloudflare Containers docs](https://developers.cloudflare.com/containers)
- [Arbor repo](https://github.com/RUC-NLPIR/Arbor)
