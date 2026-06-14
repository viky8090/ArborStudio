# ADR 0002: Durable Objects as the Live Event Hub + WebSocket Server

**Status:** Accepted · **Date:** 2026-06-14

## Context

The dashboard is the product. It needs sub-second updates as Arbor's Coordinator
emits events. We have three concerns:

1. A live WebSocket connection from the browser to the server
2. Per-run state (tree, event log, HITL decisions, in-flight flags)
3. Cross-tab fanout (one run, many watchers)

Options:
- **A.** Cloudflare Worker with a Socket.IO-style server — doesn't work in Workers (no long-lived TCP).
- **B.** Durable Object with WebSocket Hibernation API + DO SQLite (hot storage).
- **C.** Third-party (Pusher, Ably) — adds a vendor, monthly cost, and event-shape lock-in.

## Decision

**Adopt Option B.** One RunDO per active run, named `run:<rid>`. The DO:

- Holds the live Idea Tree and event log in its embedded SQLite.
- Accepts WebSocket connections from the browser using the Hibernation API
  (pay only for active frame I/O, not idle connections).
- Persists events to R2 every 1,000 events for cold storage.
- Mediates HITL approvals: receives `idea.proposed`, holds the Container blocked
  via an in-memory flag the Container polls for, waits for the browser response,
  forwards the decision back.
- Persists per-run flags (pause, cancel, steer) in SQLite.
- Hydrates from R2 on cold start (DOs are evicted at any time).

A second DO class (`WorkspaceDO`) handles per-workspace rate limiting and
session cache.

## Consequences

**Positive:**
- 10k+ hibernating DOs cost ~$0.30/day. Cheap fanout.
- Sub-10ms latency to the browser.
- No second vendor.
- Hibernation + DO SQLite = stateful, no Redis needed.

**Negative:**
- DOs can be evicted at any time; every piece of state must be reconstructible
  from SQLite + R2. We test this with a Chaos Monkey script.
- WebSocket Hibernation can drop messages in pathological conditions; we use the
  durable variant + per-message ack + `sinceSeq` replay.
- DO request handlers cap at 30s of CPU (paid plan); the long-poll
  `nextCommand(waitMs)` must use `ctx.waitUntil` + a Promise resolved by
  `setCommand`, with a setTimeout fallback.

**Failure mode:** If Hibernation proves unreliable, drop to non-hibernating DOs
(10x more expensive) or move to Cloudflare Realtime (DO-based pubsub primitive,
newer product).

## References

- [PLAN.md §3.2](../../docs/ARCHITECTURE.md)
- [Cloudflare Durable Objects + WebSocket Hibernation](https://developers.cloudflare.com/durable-objects)
