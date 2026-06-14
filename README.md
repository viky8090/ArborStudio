# ArborStudio

> A web app for [Arbor](https://github.com/RUC-NLPIR/Arbor) — the autonomous research agent that proposes hypotheses, edits code, runs experiments, and iteratively optimizes on a hypothesis tree.

**100% on Cloudflare** — Cloudflare Workers, Durable Objects, Containers, D1, R2, KV, Queues, AI Gateway, and Pages.

- **Paper:** [arXiv:2606.11926](https://arxiv.org/pdf/2606.11926) — *Toward Generalist Autonomous Research via Hypothesis-Tree Refinement* (Jin et al., RUC + Microsoft Research, 2026)
- **Upstream Arbor repo:** https://github.com/RUC-NLPIR/Arbor
- **License:** Apache 2.0

## The hard constraint

Cloudflare Workers run V8 / JS / TS only. Arbor is 100% Python. So we **cannot embed Arbor as a library** the way we would in FastAPI.

**We run Arbor in a Cloudflare Container** — one container per active run. The Worker is just the API gateway, the Durable Objects are the WebSocket hubs and live state.

## Monorepo

```
ArborStudio/
├── apps/
│   ├── api/            Cloudflare Worker (Hono router, Durable Objects, all bindings)
│   ├── web/            Next.js 14 (App Router) + OpenNext on Cloudflare Pages
│   └── container/      Python + Arbor CLI wrapped in a long-running process
├── packages/
│   ├── contracts/      Zod schemas shared between Worker, Pages, Container
│   └── ui/             Shared React components
├── docs/
│   ├── adr/            Architecture Decision Records (8 ADRs from PLAN.md §3)
│   ├── SETUP.md        How to deploy this
│   └── ARCHITECTURE.md The plan (canonical reference)
└── .github/workflows/  CI/CD (lint, test, preview deploy, prod deploy)
```

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

## Quick start

```bash
# 1. Install
pnpm install

# 2. Run all apps locally (Worker, Pages, Container)
pnpm dev

# 3. Deploy to Cloudflare
# See docs/SETUP.md for the full deployment guide
pnpm --filter @arborstudio/api deploy
pnpm --filter @arborstudio/web deploy
pnpm --filter @arborstudio/container push
```

## Status

**Phase 0 (Foundations) — in progress.** See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full plan and [`docs/adr/`](docs/adr/) for the architectural decisions.
