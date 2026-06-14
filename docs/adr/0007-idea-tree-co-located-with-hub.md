# ADR 0007: Idea Tree Co-located with the WebSocket Hub

**Status:** Accepted · **Date:** 2026-06-14

## Context

The Idea Tree is mutated 10×/sec while a run is active. We need sub-ms reads
for the WebSocket fanout and durable cold storage for history.

We have four candidate stores:

| Store | Latency | Persistence | Use case |
|---|---|---|---|
| DO SQLite (hot) | sub-ms | per-DO; lost on eviction (rehydrated) | Live tree + event log |
| R2 | ~50ms | durable, cheap | Cold tree snapshots + REPORT.md + logs |
| D1 | ~10ms | durable, indexed | Workspace listings (cross-workspace queries) |
| Vectorize (semantic) | n/a | embeddings | "Find similar past runs" (Phase 7+) |

## Decision

**Adopt a 3-tier hybrid (with Vectorize as an opt-in 4th).**

- **Hot:** DO SQLite in the RunDO. One row per node, one row per event.
  All WebSocket fanout reads from here.
- **Cold:** R2 snapshots per cycle (`runs/<rid>/tree/cycle-NNNN.json.gz`) +
  R2 `runs/<rid>/events.ndjson.gz` chunks (1MB rotation, written every 1000 events).
- **Index:** D1 `tree_nodes` table (workspace_id, run_id, parent_id, depth,
  status, score, cycle) for the dashboard's cross-workspace listings and
  "all runs in this workspace" queries.
- **Semantic (opt-in):** Vectorize for "find past runs with similar insights" (Phase 7).

The DO periodically (every cycle boundary) writes the full tree to R2. On
`Container.start()`, the DO hydrates from R2 if it has no in-memory state. On
crash, the DO rehydrates from its own SQLite, then re-conciliates with the
Container's tree.

## Consequences

**Positive:**
- Sub-ms reads during a run (the only latency that matters for live updates).
- D1 stays small; we don't hit the 1GB / 100 writes/sec limit.
- Cold storage is essentially free on R2 (no egress).
- Tree diff between runs: read both R2 snapshots, compute a structural diff
  in the Worker (no D1 hot path).

**Negative:**
- DO eviction can drop the in-memory tree; we must rehydrate from R2 each time.
  Test with a Chaos Monkey script that calls `state.storage.deleteAll()`.
- DO SQLite writes count against DO CPU time. A burst of 1000+ writes/sec
  will slow the DO and trigger eviction. Batch inserts; flush on cycle boundary.

## References

- [PLAN.md §3.4, §6.4, §16.2 #19, #30](../../docs/ARCHITECTURE.md)
- [`apps/api/src/durable-objects/run-do.ts`](../../apps/api/src/durable-objects/run-do.ts)
