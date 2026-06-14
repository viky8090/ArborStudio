#!/usr/bin/env bash
# ArborStudio Container entrypoint.
# Phase 0: validate env, perform handshake, then enter the main loop.
# Phase 1+: spawn `arbor run` as a subprocess and stream events.

set -euo pipefail

echo "[entrypoint] ArborStudio container starting at $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Required env (set by the Worker at container start)
: "${ARBOR_API_URL:?ARBOR_API_URL is required}"
: "${ARBOR_RUN_ID:?ARBOR_RUN_ID is required}"
: "${ARBOR_WS_TOKEN:?ARBOR_WS_TOKEN is required}"
: "${ARBOR_PROJECT_ID:?ARBOR_PROJECT_ID is required}"
: "${ARBOR_WORKSPACE_ID:?ARBOR_WORKSPACE_ID is required}"

# Optional
: "${ARBOR_GOAL:=hello-world}"
: "${ARBOR_MODE:=auto}"
: "${ARBOR_MAX_CYCLES:=1}"
: "${ARBOR_CONFIG_YAML:=}"
: "${ARBOR_HEARTBEAT_INTERVAL:=30}"
: "${ARBOR_LOG_LEVEL:=INFO}"

# Hand off to the Python main loop
exec python -m arbor_studio_runner.entrypoint
