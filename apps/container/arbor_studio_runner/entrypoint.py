# ArborStudio Python runtime — wraps the Arbor CLI in a long-running process
# that's spawned by a Cloudflare Container, one per active run.
"""
arbor_studio_runner — Phase 0 hello world.

In Phase 0 the container:
  1. Reads env vars (ARBOR_API_URL, ARBOR_RUN_ID, ARBOR_WS_TOKEN, etc.)
  2. Calls /api/internal/runs/:rid/heartbeat every 30s
  3. Polls /api/internal/runs/:rid/command (long-poll 30s) for commands
  4. Sends a synthetic "hello" event so the dashboard shows something

In Phase 1+ this is replaced by:
  1. Receive the project archive from R2 (signed URL)
  2. Untar into /workspace
  3. Inject LLM keys as env vars
  4. Spawn `arbor run --yes --config /workspace/config.yaml --yes-cwd /workspace`
  5. Parse Arbor's stdout for structured events
  6. Push events to /api/internal/runs/:rid/event
  7. Save checkpoints to R2
"""

from __future__ import annotations

import asyncio
import json
import os
import signal
import sys
import time
from typing import Any

import httpx
import structlog

log = structlog.get_logger()


class ArborRunner:
    def __init__(self) -> None:
        self.api_url = os.environ["ARBOR_API_URL"].rstrip("/")
        self.run_id = os.environ["ARBOR_RUN_ID"]
        self.ws_token = os.environ["ARBOR_WS_TOKEN"]
        self.project_id = os.environ["ARBOR_PROJECT_ID"]
        self.workspace_id = os.environ["ARBOR_WORKSPACE_ID"]
        self.goal = os.environ.get("ARBOR_GOAL", "hello-world")
        self.mode = os.environ.get("ARBOR_MODE", "auto")
        self.max_cycles = int(os.environ.get("ARBOR_MAX_CYCLES", "1"))
        self.config_yaml = os.environ.get("ARBOR_CONFIG_YAML", "")
        self.heartbeat_interval = int(os.environ.get("ARBOR_HEARTBEAT_INTERVAL", "30"))
        self._stopped = False
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))

    async def start(self) -> int:
        log.info(
            "container_starting",
            run_id=self.run_id,
            project_id=self.project_id,
            workspace_id=self.workspace_id,
            mode=self.mode,
            max_cycles=self.max_cycles,
        )
        await self._send_event(
            type="container.started",
            data={
                "image": "arbor-runner:phase0",
                "goal": self.goal,
                "mode": self.mode,
            },
        )
        # Start background tasks
        hb = asyncio.create_task(self._heartbeat_loop())
        cmds = asyncio.create_task(self._command_loop())
        try:
            await asyncio.gather(hb, cmds)
        finally:
            await self._client.aclose()
        return 0

    async def _heartbeat_loop(self) -> None:
        while not self._stopped:
            try:
                r = await self._client.post(
                    f"{self.api_url}/api/internal/runs/{self.run_id}/heartbeat",
                    headers={"authorization": f"Bearer {self.ws_token}"},
                )
                r.raise_for_status()
            except Exception as e:
                log.warning("heartbeat_failed", err=str(e))
            await asyncio.sleep(self.heartbeat_interval)

    async def _command_loop(self) -> None:
        """Long-poll for commands; send synthetic events in Phase 0."""
        # Phase 0: emit a few "demo" events so the UI has something to show.
        for i in range(3):
            if self._stopped:
                return
            await asyncio.sleep(5)
            await self._send_event(
                type="cycle.started",
                data={"cycle": i, "goal": self.goal},
            )
            await asyncio.sleep(2)
            await self._send_event(
                type="log.line",
                data={"stream": "stdout", "line": f"[phase0] tick {i} on goal: {self.goal[:60]}"},
            )
            await self._send_event(
                type="cycle.completed",
                data={"cycle": i, "duration_ms": 2000, "ok": True},
            )
        # Then settle into the long-poll
        while not self._stopped:
            try:
                r = await self._client.get(
                    f"{self.api_url}/api/internal/runs/{self.run_id}/command",
                    params={"wait": 30},
                    headers={"authorization": f"Bearer {self.ws_token}"},
                )
                r.raise_for_status()
                cmd = r.json()
                if cmd:
                    log.info("command_received", cmd=cmd)
                    await self._handle_command(cmd)
            except Exception as e:
                log.warning("command_poll_failed", err=str(e))
                await asyncio.sleep(5)

    async def _handle_command(self, cmd: dict[str, Any]) -> None:
        if cmd.get("cancel"):
            log.info("cancel_received")
            await self._send_event(type="run.cancelled", data={"reason": "user"})
            self._stopped = True
        elif cmd.get("pause"):
            log.info("pause_received")
            await self._send_event(type="status.changed", data={"from": "running", "to": "paused"})
        elif cmd.get("steer"):
            log.info("steer_received", text=cmd["steer"])
            await self._send_event(
                type="log.line",
                data={"stream": "stdout", "line": f"[steer] {cmd['steer'][:100]}"},
            )
        elif cmd.get("pending_hitl_decision"):
            log.info("hitl_decision_received", decision=cmd["pending_hitl_decision"])
            await self._send_event(
                type="log.line",
                data={"stream": "stdout", "line": f"[hitl] {cmd['pending_hitl_decision']}"},
            )

    async def _send_event(self, *, type: str, data: dict[str, Any]) -> None:
        payload = {"type": type, "payload": data, "ts": int(time.time() * 1000)}
        try:
            r = await self._client.post(
                f"{self.api_url}/api/internal/runs/{self.run_id}/event",
                headers={"authorization": f"Bearer {self.ws_token}", "content-type": "application/json"},
                content=json.dumps(payload),
            )
            r.raise_for_status()
        except Exception as e:
            log.warning("event_send_failed", err=str(e), type=type)

    def request_stop(self, *_args: Any) -> None:
        log.info("stop_signal_received")
        self._stopped = True


async def amain() -> int:
    runner = ArborRunner()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, runner.request_stop)
    return await runner.start()


def main() -> int:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
    )
    try:
        return asyncio.run(amain())
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
