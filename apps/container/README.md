# ArborStudio Container

> The Python runtime that runs the Arbor CLI for each active run. One container per run.

This image is **not** a web server. It's a long-running Python process that:
1. Receives a startup handshake from the Worker (signed JWT, project archive, config, LLM keys)
2. Sets env vars for LLM providers
3. Runs `arbor run --yes --config /workspace/config.yaml --yes-cwd /workspace` as a subprocess
4. Parses stdout/stderr for structured events
5. Pushes events to the Worker (`/api/internal/runs/<rid>/event`)
6. Sends a heartbeat every 30s
7. Long-polls the Worker for commands (pause, cancel, steer, HITL decisions)
8. On SIGTERM, uploads final tree snapshot + REPORT.md to R2 via the Worker's signed endpoint

## Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage: python:3.11-slim + git + arbor==0.1.0 |
| `entrypoint.sh` | Main loop: handshake → poll commands → run arbor |
| `poller.py` | Long-polls `GET /api/internal/runs/:rid/command` |
| `runner.py` | Wraps `arbor run` subprocess, parses stdout |
| `streamer.py` | Posts events to the Worker |
| `heartbeat.py` | 30s heartbeat task |
| `secrets_loader.py` | Decodes JWT-injected LLM keys, sets env vars |
| `sigterm_handler.py` | On SIGTERM: zero keys, upload final artifacts |
| `lib/event_parser.py` | Parses Arbor's stdout into structured events |
| `lib/budget.py` | Local cost guard (re-checks USD cap every 30s) |
| `lib/r2_sync.py` | (Future) Sync project from R2 |

## Build & run

```bash
# Build
docker build -t arbor-runner:latest .

# Run locally (with a real API URL)
docker run --rm \
  -e ARBOR_API_URL=http://host.docker.internal:8787 \
  -e ARBOR_RUN_ID=r_test \
  -e ARBOR_WS_TOKEN=dev-token \
  -e ARBOR_PROJECT_ID=p_test \
  -e ARBOR_WORKSPACE_ID=ws_test \
  arbor-runner:latest
```

## Deploy to Cloudflare Containers

The `wrangler deploy` of the API Worker automatically pushes the latest image
configured in `apps/api/wrangler.toml` under `[[containers]]`.

## Local dev (no Docker)

```bash
uv sync
uv run python -m arbor_studio_runner.entrypoint
```

(Phase 1+: the local-dev path uses the same code but talks to `wrangler dev`.)
