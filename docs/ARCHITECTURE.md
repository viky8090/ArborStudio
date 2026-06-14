# ArborStudio — Architecture

> The canonical architecture reference is **`~/Desktop/arbor-webapp-plan/PLAN.md`** (1,490 lines, ~99KB).

## Quick summary

ArborStudio is a 100% Cloudflare-native web app for the Arbor autonomous research agent.

- **Worker (TypeScript, Hono):** API gateway, 8 route groups, 2 Durable Object classes
- **Durable Objects:** `RunDO` (per-run WebSocket hub + tree + event log) and `WorkspaceDO` (per-workspace rate limit + session cache)
- **Cloudflare Container:** Python + Arbor CLI, one per active run
- **D1:** One DB per workspace for blast-radius isolation
- **R2:** Tree snapshots, REPORT.md, per-experiment artifacts (zero egress)
- **AI Gateway:** All LLM calls routed through here
- **Queues:** Event bursts from Container → Worker → DO
- **KV:** Rate limit counters, feature flags, session cache
- **Pages + OpenNext:** Next.js 14 dashboard

## The Cloudflare Triangle

```
                  ┌─────────────────────────────┐
                  │ Cloudflare Pages (Next.js)  │  ← UI
                  └──────────────┬──────────────┘
                                 │ HTTPS / WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────┐
│             Cloudflare Workers (TS + Hono)             │  ← API gateway
└──────┬──────────────────────────────────┬──────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────┐            ┌───────────────────────┐
│  Durable Objects │            │  Cloudflare Containers│  ← compute
│  + DO-SQLite     │◀──HTTP─────┤  (Python + git +      │
│  (WS hub)        │  stream    │   Arbor)              │
└────────┬─────────┘            └──────────┬────────────┘
         │                                  │
         ▼                                  ▼
   ┌────────────┐                    ┌──────────────┐
   │  D1 / KV   │                    │  R2 / AI GW  │
   └────────────┘                    └──────────────┘
```

## Architecture Decision Records

The 8 ADRs (in [`adr/`](adr/)) are the source of truth for the design decisions:

1. [ADR 0001 — Run Arbor in a Cloudflare Container, not a Worker](adr/0001-arbor-in-cloudflare-container.md)
2. [ADR 0002 — Durable Objects as the Live Event Hub + WebSocket Server](adr/0002-durable-objects-as-ws-hub.md)
3. [ADR 0003 — Per-Workspace D1 Database (with one shared "default" in dev)](adr/0003-per-workspace-d1-isolation.md)
4. [ADR 0004 — LLM API Keys Never Leave the Container](adr/0004-llm-keys-never-leave-container.md)
5. [ADR 0005 — AI Gateway as the LLM Frontend](adr/0005-ai-gateway-as-llm-frontend.md)
6. [ADR 0006 — Cloudflare Pages + OpenNext, Not Vercel](adr/0006-pages-opennext-not-vercel.md)
7. [ADR 0007 — Idea Tree Co-located with the WebSocket Hub](adr/0007-idea-tree-co-located-with-hub.md)
8. [ADR 0008 — Three-Mode HITL Flows Through the Durable Object](adr/0008-three-mode-hitl.md)

## Full plan

Read `~/Desktop/arbor-webapp-plan/PLAN.md` for the complete senior-developer plan, including:

- 77-row feature inventory of Arbor
- 18-row gap analysis (gaps closed by this web app)
- Full API surface (REST + WebSocket + Container-internal)
- Full data model (D1 + DO SQLite + R2)
- UI/UX design (Idea Tree, cycle log, evidence, cost, plugin/skill editors)
- Auth + security + observability
- 7-phase delivery plan (12 weeks for 2 engineers)
- 30-day MVP subset
- 36 critical pitfalls (20 Cloudflare-specific)

## Setup

See [`SETUP.md`](SETUP.md) for the deploy + dev guide.
