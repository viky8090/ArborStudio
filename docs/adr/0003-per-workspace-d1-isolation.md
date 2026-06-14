# ADR 0003: Per-Workspace D1 Database (with one shared "default" in dev)

**Status:** Accepted · **Date:** 2026-06-14

## Context

We need a relational database for projects, runs, evidence, plugins, skills,
usage, and audit. Cloudflare's only SQL option is D1 (SQLite-based).

Options:
- **A.** One D1 database, all workspaces share it (workspace_id column on every table).
- **B.** One D1 database per workspace (binding resolver at runtime).
- **C.** External Postgres via Hyperdrive.

## Decision

**Adopt Option B** (per-workspace D1) in production, with a single `ws_default`
binding for local dev. The data model is identical either way; multi-tenancy
is enforced by the binding name (workspaces literally cannot see each other's data).

The Worker's `workspaceDb(env, wid)` function returns the right binding:
- Local dev: `env.DB_WS_DEFAULT`
- Production: a dynamic binding looked up via the Cloudflare REST API at workspace
  creation time, or a static binding per workspace added in `wrangler.toml` (the
  practical approach for up to ~1000 workspaces).

## Consequences

**Positive:**
- True blast-radius isolation: a buggy query in one workspace can't affect another.
- D1 1GB database limit is naturally per-tenant.
- Migration to per-workspace D1 is a one-time setup in `workspaces.create`.

**Negative:**
- D1 has 10MB row-size and 1GB database limits; large workspaces (10k+ runs) need
  their `tree_nodes` summary moved to DO + R2 (already the design).
- D1 write throughput per database is ~100 writes/sec; DOs handle the hot state.
- One D1 binding per workspace is a deployment concern: wrangler.toml grows
  with workspace count. We use a resolver pattern for > 100 workspaces.
- Migrations must run on every new DB; automate in the `workspaces.create` route.

## References

- [PLAN.md §6.1](../../docs/ARCHITECTURE.md)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits)
