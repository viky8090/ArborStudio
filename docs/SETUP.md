# ArborStudio — Setup Guide

> This is the **deploy + dev** guide. For the architecture, see [`ARCHITECTURE.md`](ARCHITECTURE.md).
> For the design decisions, see [`adr/`](adr/).

## TL;DR

```bash
# 1. Install deps
pnpm install

# 2. Local dev (Worker on :8787, Pages on :3000, Container in Docker)
pnpm dev

# 3. Deploy (requires a Cloudflare account + GitHub repo with secrets)
git push origin main
```

That's it. CI builds, tests, and deploys.

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node | ≥ 22 | Cloudflare Workers runtime + Next.js 14 |
| pnpm | ≥ 10 | Monorepo package manager |
| Docker | ≥ 24 | Local Container dev (Phase 1+) |
| Python | ≥ 3.11 | Container build |
| uv | ≥ 0.11 | Container Python deps (optional but recommended) |
| Wrangler | ≥ 3.95 | Cloudflare CLI |
| GitHub CLI | ≥ 2.80 | (Optional) one-command repo creation |

## Local development (no Cloudflare account needed)

```bash
# 1. Clone
git clone https://github.com/viky8090/ArborStudio.git
cd ArborStudio
pnpm install

# 2. Copy secrets
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local

# 3. Generate a dev KEK
echo "KEK=\"$(openssl rand -base64 32)\"" >> apps/api/.dev.vars

# 4. Start the API Worker (port 8787)
pnpm --filter @arborstudio/api dev

# 5. In another terminal, start the Next.js UI (port 3000)
pnpm --filter @arborstudio/web dev

# 6. (Phase 1+) In another terminal, build + run the Container
docker build -t arbor-runner apps/container
docker run --rm \
  -e ARBOR_API_URL=http://host.docker.internal:8787 \
  -e ARBOR_RUN_ID=r_demo \
  -e ARBOR_WS_TOKEN=dev-test \
  -e ARBOR_PROJECT_ID=p_demo \
  -e ARBOR_WORKSPACE_ID=ws_demo \
  arbor-runner
```

Open <http://localhost:3000> and sign up.

## Local dev (full Cloudflare emulation)

For an end-to-end local test with real D1, R2, KV, and DO bindings:

```bash
# In apps/api
pnpm --filter @arborstudio/api dev --remote   # --remote uses your real CF account
```

This still uses the Wrangler local dev server, but `wrangler dev --remote` proxies
all binding calls to your real Cloudflare account. Useful for testing multi-tenant
D1 isolation.

## Production deploy

### 1. Get Cloudflare credentials

1. Create a Cloudflare account at <https://dash.cloudflare.com/sign-up>.
2. Grab your **Account ID** from the Workers dashboard URL.
3. Create an **API Token** with these permissions:
   - Account.Workers Scripts:Edit
   - Account.Workers KV Storage:Edit
   - Account.Workers R2 Storage:Edit
   - Account.Workers D1:Edit
   - Account.Workers Containers:Edit
   - Account.Account Settings:Read
   - Account.Workers Analytics:Edit
   - Zone.Zone:Read (if you add a custom domain)
4. Add the token + account ID to your GitHub repo as secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### 2. Create the Cloudflare resources

```bash
# Login
wrangler login

# D1 (do this once; the Worker binds to the IDs)
wrangler d1 create arbor-meta
wrangler d1 create ws_default
# Note the database_id values; paste them into apps/api/wrangler.toml

# R2 bucket
wrangler r2 bucket create arbor-assets
wrangler r2 bucket create arbor-assets-preview

# KV namespace
wrangler kv namespace create arbor-kv
wrangler kv namespace create arbor-kv-preview
# Note the IDs; paste them into apps/api/wrangler.toml

# Container registry
# (Cloudflare Container Registry is per-account and auto-created on first push)
```

### 3. Update `apps/api/wrangler.toml`

Replace the four `REPLACE_WITH_REAL_ID` placeholders with the IDs you got from the
commands above.

### 4. Create and push the GitHub repo

```bash
# Create the repo on GitHub (e.g., using gh CLI)
gh repo create viky8090/ArborStudio --public --source=. --remote=origin --push

# Or manually: create the repo on github.com, then:
git remote add origin https://github.com/viky8090/ArborStudio.git
git push -u origin main
```

### 5. Watch CI deploy

Go to <https://github.com/viky8090/ArborStudio/actions>. The `Deploy API` and
`Deploy Web` workflows will run on the first push to `main`.

Your URLs:
- **API:** `https://arbor-api-production.<your-subdomain>.workers.dev`
- **Web:** `https://arbor-web.pages.dev` (or your custom domain)

## Phase 0 verification checklist

After deploy, verify each end-to-end path:

- [ ] `curl https://<api>/healthz` returns `{"status":"ok"}`
- [ ] `curl https://<api>/readyz` returns `{"status":"ok"}` with all bindings green
- [ ] Open `<web>/` → marketing page loads
- [ ] Sign up at `<web>/signup` → redirected to dashboard
- [ ] Open `<web>/projects` → click "Launch phase-0 run" → events stream in the live log
- [ ] Open the API Workers dashboard → tail logs → see request logs with redacted keys

## Where things live

```
ArborStudio/
├── apps/
│   ├── api/                   # Cloudflare Worker (Hono + Durable Objects)
│   ├── web/                   # Next.js 14 + OpenNext on Cloudflare Pages
│   └── container/             # Python + Arbor CLI in a Cloudflare Container
├── packages/
│   ├── contracts/             # Zod schemas (shared)
│   └── ui/                    # (Phase 1) shared React components
├── docs/
│   ├── adr/                   # 8 ADRs (mirrors PLAN.md §3.1-3.8)
│   ├── ARCHITECTURE.md        # link to ~/Desktop/arbor-webapp-plan/PLAN.md
│   └── SETUP.md               # this file
└── .github/workflows/         # CI + deploy
```

## Common tasks

### Add a new API route

1. Add a Hono handler in `apps/api/src/routes/<name>.ts`.
2. Register it in `apps/api/src/router.ts`.
3. Add a Zod schema in `packages/contracts/src/api.ts` (or the relevant file).
4. Add a typed client in `apps/web/lib/api.ts`.
5. Use it from a `apps/web/app/(app)/...` page.

### Add a new event type

1. Add it to `packages/contracts/src/events.ts` (`EventType` enum + frame shape).
2. Handle it in `apps/api/src/durable-objects/run-do.ts` (`mirrorTreeFromEvent` or a new branch).
3. Render it in the UI (`apps/web/app/(app)/projects/page.tsx` for now; the Run detail page in Phase 1).

### Rotate the KEK

1. Generate a new 32-byte base64 KEK: `openssl rand -base64 32`.
2. Update the secret: `wrangler secret put KEK` in the `apps/api` dir.
3. Run a Cron Trigger that re-wraps every workspace's DEK. (This is a Phase 5+ script — see `apps/api/src/cron/`.)

### Reset local D1

```bash
# Stop wrangler, then:
rm -rf apps/api/.wrangler/state/v3/d1
pnpm --filter @arborstudio/api dev   # schema recreates on first request
```

## What's NOT in Phase 0 (and is therefore in the next phases)

- Real Arbor CLI integration (Container currently emits synthetic events)
- Project creation UI
- Real LLM calls (we don't have keys wired up by default)
- HITL approval modal
- Plugin/skill editor
- Cost dashboard
- GitHub / Slack / Linear integrations
- Stripe billing
- Multi-region deploy

All of these land in Phase 1+. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full plan.
