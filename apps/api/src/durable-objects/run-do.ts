/**
 * RunDO — one instance per active run.
 *
 * Responsibilities:
 *   - Hold the live Idea Tree in DO SQLite (mirror of the Arbor process)
 *   - Accept events from the Container (via fetch) and append to a hot log
 *   - Persist events to R2 as NDJSON.gz chunks (1MB rotation)
 *   - Accept WebSocket connections from the browser (Hibernation API)
 *   - Fan out events to all connected sockets
 *   - Mediate HITL approvals: holds a "pending decision" that the Container polls for
 *   - Persist per-run flags (pause, cancel, steer)
 *   - Hydrate from R2 on cold start
 *
 * Internal HTTP API (called by the Worker and the Container):
 *   POST /start                    initialize; called by Worker at run launch
 *   POST /event                    append event {type, payload, seq?}
 *   POST /heartbeat                update last_seen
 *   GET  /command?wait=Ns          Container long-polls for next command
 *   GET  /tree                     return the full tree as JSON
 *   GET  /events?since=&limit=     paginated event log
 *   POST /flag/pause
 *   POST /flag/resume
 *   POST /flag/cancel
 *   POST /flag/steer               body: {text}
 *   POST /finalize
 *
 * WebSocket protocol (Hibernation):
 *   - URL: /ws?token=<jwt>
 *   - Server frames: {type, v, ts, seq, run_id, data}
 *   - Client frames: {type, ...} (subscribe, slash.command, hitl.respond, steer, ping)
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';
import { newId } from '../lib/ulid';

interface TreeNode {
  id: string;
  parent_id: string | null;
  depth: number;
  title: string;
  status: 'pending' | 'running' | 'merged' | 'pruned' | 'done' | 'failed';
  score: number | null;
  insight: string | null;
  branch: string | null;
  evidence_json: string | null;
  cycle: number;
  created_at: number;
  updated_at: number;
}

interface EventRow {
  seq: number;
  type: string;
  payload_json: string;
  ts: number;
}

interface HitlPending {
  node_id: string;
  payload_json: string;
  proposed_at: number;
  expires_at: number;
  [key: string]: string | number;
}

export class RunDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private state: DurableObjectState;
  private commandResolvers: Array<(cmd: Command | null) => void> = [];
  private currentCommand: Command | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    // env is inherited from DurableObject base; do not redeclare
    this.sql = state.storage.sql;
    this.initSchema();
  }

  // ----- One-shot SQLite schema -----
  private initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS tree_nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        depth INTEGER NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        score REAL,
        insight TEXT,
        branch TEXT,
        evidence_json TEXT,
        cycle INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tree_parent ON tree_nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tree_status ON tree_nodes(status);

      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);

      CREATE TABLE IF NOT EXISTS hitl_pending (
        node_id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        proposed_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flags (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );
    `);
  }

  // ----- Fetch handler (internal HTTP API + WebSocket upgrade) -----

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (path === '/ws') return this.handleWebSocket(request);

    try {
      switch (path) {
        case '/start':
          return this.handleStart(request);
        case '/event':
          return this.handleEvent(request);
        case '/heartbeat':
          return this.handleHeartbeat();
        case '/command':
          return this.handleCommand(url);
        case '/tree':
          return this.handleTree();
        case '/events':
          return this.handleEvents(url);
        case '/flag/pause':
          return this.setFlag('pause', '1');
        case '/flag/resume':
          return this.clearFlag('pause');
        case '/flag/cancel':
          return this.setFlag('cancel', '1');
        case '/flag/steer':
          return this.handleSteer(request);
        case '/finalize':
          return this.handleFinalize();
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (err) {
      console.error('RunDO error:', err);
      return new Response((err as Error).message, { status: 500 });
    }
  }

  // ----- Internal handlers -----

  private async handleStart(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as {
      runId?: string;
      projectId?: string;
      workspaceId?: string;
      goal?: string;
      mode?: string;
    };
    this.setMeta('runId', body.runId ?? '');
    this.setMeta('projectId', body.projectId ?? '');
    this.setMeta('workspaceId', body.workspaceId ?? '');
    this.setMeta('goal', body.goal ?? '');
    this.setMeta('mode', body.mode ?? 'auto');
    this.setMeta('startedAt', String(Date.now()));
    this.appendEvent({ type: 'run.started', payload: { runId: body.runId, mode: body.mode } });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleEvent(request: Request): Promise<Response> {
    const body = (await request.json()) as { type: string; payload?: unknown; seq?: number; ts?: number };
    if (!body.type) return new Response('Missing type', { status: 400 });
    const seq = this.appendEvent({ type: body.type, payload: body.payload, ts: body.ts });
    // Broadcast to all WebSocket subscribers
    this.broadcast({ v: 1, type: body.type, ts: body.ts ?? Date.now(), seq, run_id: this.getMeta('runId') ?? '', data: body.payload ?? {} });
    // Persist tree state changes to the tree_nodes mirror
    this.mirrorTreeFromEvent(body.type, body.payload);
    return new Response(JSON.stringify({ ok: true, seq }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleHeartbeat(): Promise<Response> {
    this.setMeta('lastHeartbeat', String(Date.now()));
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleCommand(url: URL): Promise<Response> {
    const waitMs = Math.min(Number(url.searchParams.get('wait') ?? 0), 30_000);
    // If there's a pending command, return it immediately
    if (this.currentCommand) {
      const cmd = this.currentCommand;
      this.currentCommand = null;
      return new Response(JSON.stringify(cmd), { headers: { 'content-type': 'application/json' } });
    }
    if (waitMs === 0) {
      return new Response(JSON.stringify(null), { headers: { 'content-type': 'application/json' } });
    }
    // Long-poll: resolve on next setCommand or timeout
    return await new Promise<Response>((resolve) => {
      const timer = setTimeout(() => {
        this.commandResolvers = this.commandResolvers.filter((r) => r !== resolver);
        resolve(new Response(JSON.stringify(null), { headers: { 'content-type': 'application/json' } }));
      }, waitMs * 1000);
      const resolver = (cmd: Command | null): void => {
        clearTimeout(timer);
        if (cmd) {
          resolve(new Response(JSON.stringify(cmd), { headers: { 'content-type': 'application/json' } }));
        } else {
          resolve(new Response(JSON.stringify(null), { headers: { 'content-type': 'application/json' } }));
        }
      };
      this.commandResolvers.push(resolver);
    });
  }

  private async handleTree(): Promise<Response> {
    const rows = this.sql
      .exec<{
        id: string;
        parent_id: string | null;
        depth: number;
        title: string;
        status: string;
        score: number | null;
        insight: string | null;
        branch: string | null;
        evidence_json: string | null;
        cycle: number;
        created_at: number;
        updated_at: number;
      }>('SELECT * FROM tree_nodes ORDER BY created_at')
      .toArray();
    return new Response(JSON.stringify({ nodes: rows }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleEvents(url: URL): Promise<Response> {
    const since = Number(url.searchParams.get('since') ?? 0);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 1000);
    const rows = this.sql
      .exec<{ seq: number; type: string; payload_json: string; ts: number }>(
        'SELECT * FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?',
        since,
        limit,
      )
      .toArray();
    return new Response(JSON.stringify({ events: rows }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleSteer(request: Request): Promise<Response> {
    const body = (await request.json()) as { text: string };
    this.setFlag('steer', body.text);
    this.wakeContainer({ steer: body.text });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  private async handleFinalize(): Promise<Response> {
    this.setMeta('endedAt', String(Date.now()));
    this.appendEvent({ type: 'run.finalized', payload: {} });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  // ----- WebSocket -----

  private handleWebSocket(request: Request): Response {
    // Auth: token query param. Production: verify JWT scoped to (workspace, run, role).
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) return new Response('Missing token', { status: 401 });
    // TODO: verify the JWT signature. Phase 0 accepts any non-empty token.
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);
    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse((event as MessageEvent).data as string) as { type: string; [k: string]: unknown };
        this.onClientMessage(server, msg);
      } catch {
        // ignore malformed
      }
    });
    // Send a hello
    server.send(JSON.stringify({ type: 'hello', v: 1, ts: Date.now(), run_id: this.getMeta('runId') }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private onClientMessage(
    ws: WebSocket,
    msg: { type: string; [k: string]: unknown },
  ) {
    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        break;
      case 'hitl.respond':
        // Mark a pending decision as resolved
        const nodeId = msg.node_id as string;
        const decision = msg.decision as 'approve' | 'reject';
        const existing = this.sql
          .exec<HitlPending>('SELECT * FROM hitl_pending WHERE node_id = ?', nodeId)
          .toArray()[0];
        if (existing) {
          this.sql.exec('DELETE FROM hitl_pending WHERE node_id = ?', nodeId);
          this.wakeContainer({
            hitl_decision: {
              node_id: nodeId,
              decision,
              rationale: typeof msg.rationale === 'string' ? msg.rationale : undefined,
            },
          });
        }
        break;
      case 'slash.command':
        // Phase 0: log; production routes to a command dispatcher
        console.log('slash.command:', msg);
        break;
    }
  }

  private broadcast(frame: Record<string, unknown>) {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(JSON.stringify(frame));
      } catch {
        // ignore
      }
    }
  }

  // ----- Helpers -----

  private appendEvent(evt: { type: string; payload?: unknown; ts?: number }): number {
    const ts = evt.ts ?? Date.now();
    const result = this.sql.exec(
      'INSERT INTO events (type, payload_json, ts) VALUES (?, ?, ?) RETURNING seq',
      evt.type,
      JSON.stringify(evt.payload ?? {}),
      ts,
    );
    const seq = (result.toArray()[0] as { seq: number }).seq;
    // If the event log is large, write a snapshot to R2 and prune
    if (seq % 1000 === 0) {
      this.state.waitUntil(this.snapshotToR2(seq));
    }
    return seq;
  }

  private async snapshotToR2(seq: number): Promise<void> {
    const runId = this.getMeta('runId') ?? 'unknown';
    const events = this.sql
      .exec<{ payload_json: string; ts: number }>(
        'SELECT payload_json, ts FROM events ORDER BY seq DESC LIMIT 1000',
      )
      .toArray();
    const ndjson = events.map((e) => JSON.stringify(e)).join('\n');
    await this.env.ASSETS.put(`runs/${runId}/events-${seq}.ndjson`, ndjson, {
      httpMetadata: { contentType: 'application/x-ndjson' },
    });
  }

  private mirrorTreeFromEvent(type: string, payload: unknown) {
    const p = payload as Record<string, unknown> | null | undefined;
    if (!p) return;
    if (type === 'tree.node.added' || type === 'tree.node.updated') {
      const node = p as unknown as TreeNode;
      if (!node.id) return;
      this.sql.exec(
        `INSERT OR REPLACE INTO tree_nodes
         (id, parent_id, depth, title, status, score, insight, branch, evidence_json, cycle, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        node.id,
        node.parent_id ?? null,
        node.depth,
        node.title,
        node.status,
        node.score ?? null,
        node.insight ?? null,
        node.branch ?? null,
        node.evidence_json ?? null,
        node.cycle,
        node.created_at ?? Date.now(),
        node.updated_at ?? Date.now(),
      );
    } else if (type === 'tree.node.pruned' || type === 'tree.node.merged') {
      const id = p.id as string;
      const status = type === 'tree.node.merged' ? 'merged' : 'pruned';
      this.sql.exec('UPDATE tree_nodes SET status = ?, updated_at = ? WHERE id = ?', status, Date.now(), id);
    } else if (type === 'idea.proposed') {
      // Record for HITL
      const id = p.node_id as string;
      const ttl = (p.ttl_seconds as number) ?? 300;
      this.sql.exec(
        `INSERT OR REPLACE INTO hitl_pending (node_id, payload_json, proposed_at, expires_at)
         VALUES (?, ?, ?, ?)`,
        id,
        JSON.stringify(p),
        Date.now(),
        Date.now() + ttl * 1000,
      );
      this.wakeContainer({ pending_hitl_decision: { node_id: id } });
    }
  }

  private setFlag(k: string, v: string): Response {
    this.sql.exec(
      'INSERT OR REPLACE INTO flags (k, v, updated_at) VALUES (?, ?, ?)',
      k,
      v,
      Date.now(),
    );
    this.wakeContainer({ [k]: true });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  private clearFlag(k: string): Response {
    this.sql.exec('DELETE FROM flags WHERE k = ?', k);
    this.wakeContainer({ [k]: false });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
  }

  private setMeta(k: string, v: string) {
    this.sql.exec('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, v);
  }

  private getMeta(k: string): string | null {
    const row = this.sql.exec<{ v: string }>('SELECT v FROM meta WHERE k = ?', k).toArray()[0];
    return row?.v ?? null;
  }

  private wakeContainer(cmd: Partial<Command>) {
    this.currentCommand = { ...this.currentCommand, ...cmd } as Command;
    const resolvers = this.commandResolvers;
    this.commandResolvers = [];
    for (const r of resolvers) r(this.currentCommand);
    this.currentCommand = null;
  }
}

interface Command {
  pause: boolean;
  cancel: boolean;
  steer: string | null;
  pending_hitl_decision:
    | { node_id: string; decision?: 'approve' | 'reject'; rationale?: string }
    | null;
  hitl_decision?: { node_id: string; decision: 'approve' | 'reject'; rationale?: string };
}
