# ADR 0008: Three-Mode HITL Flows Through the Durable Object

**Status:** Accepted · **Date:** 2026-06-14

## Context

We need three human-in-the-loop modes that Arbor's CLI supports only partially:

| Mode | CLI behavior | Web app behavior |
|---|---|---|
| `auto` | Coordinator runs without asking | Same; user observes only |
| `review` | `--mode review` (CLI exists, but UI is ad-hoc) | Before each Dispatch, the DO holds the Container blocked, asks the browser for approval, forwards the decision back |
| `steer` | Not in the CLI | Free-text "live guidance" pane; the DO injects the text into the next OBSERVE prompt |

HITL is **not** a request/response inside the Worker. It's a tri-party protocol:
- **Coordinator** is the source of truth for "is this idea approved?".
- **RunDO** is the source of truth for "is the user approving/rejecting?".
- **Browser** is the source of truth for "the user has decided".

The Container asks the DO before each Dispatch.

## Decision

**HITL state lives in the RunDO; the Worker is just a relay.**

Flow:
1. Container pushes `idea.proposed` event → DO records in `hitl_pending` table with TTL.
2. DO broadcasts `idea.proposed` to all connected browsers.
3. Browser shows an approval modal; user clicks approve/reject.
4. Browser sends `{ type: "hitl.respond", node_id, decision, rationale }` over the WS.
5. DO updates `hitl_pending`; wakes the Container's `nextCommand` long-poll with the decision.
6. Container resumes the cycle.

The TTL defaults to 5 minutes; on expiry, the DO auto-rejects (configurable per workspace).

## Consequences

**Positive:**
- The Worker is stateless; HITL is a single source of truth (the DO).
- Cross-tab: first approval wins. DO holds the decision in a single row.
- The audit log captures every decision (with rationale).
- "Steer" mode is a web-app-only feature, no CLI change.

**Negative:**
- If the user closes all browser tabs while a HITL is pending, the decision
  auto-rejects at TTL. This is the right default (no silent approvals).
- The WS must be authenticated to the workspace, or users could approve ideas
  on other users' runs. Enforced at WS upgrade (see ADR 0004 + §11 of PLAN.md).

## References

- [PLAN.md §3.3, §11](../../docs/ARCHITECTURE.md)
- [`apps/api/src/durable-objects/run-do.ts`](../../apps/api/src/durable-objects/run-do.ts)
