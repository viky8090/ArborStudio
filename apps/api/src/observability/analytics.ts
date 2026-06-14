/**
 * Analytics Engine helpers.
 * High-cardinality metrics for runs, cycles, costs, WS connections.
 *
 * Each AnalyticsEngineDataset is queried via SQL-compatible API.
 * We use a single dataset (`arbor_metrics`) with a `blob1` field that
 * labels the event type.
 */

import type { Env } from '../index';

export type MetricEvent =
  | { kind: 'run_started'; runId: string; workspaceId: string; mode: string; model: string }
  | { kind: 'run_completed'; runId: string; workspaceId: string; cycles: number; costUsd: number; status: string }
  | { kind: 'cycle_completed'; runId: string; workspaceId: string; cycle: number; durationMs: number }
  | { kind: 'cost_tick'; runId: string; workspaceId: string; tokensIn: number; tokensOut: number; costUsd: number; model: string }
  | { kind: 'ws_connected'; runId: string; workspaceId: string; userId: string }
  | { kind: 'ws_disconnected'; runId: string; userId: string; durationMs: number }
  | { kind: 'container_started'; runId: string; coldStart: boolean }
  | { kind: 'container_idle'; runId: string; idleMs: number }
  | { kind: 'hitl_decision'; runId: string; decision: 'approve' | 'reject'; latencyMs: number };

export function track(event: MetricEvent, env: Env): void {
  if (!env.ANALYTICS) return;
  // blob1 = kind, blob2 = workspaceId, blob3 = runId (most common filter), doubles for numerics
  env.ANALYTICS.writeDataPoint({
    blobs: [
      event.kind,
      'workspaceId' in event ? event.workspaceId : '',
      'runId' in event ? event.runId : '',
    ],
    doubles: [
      'costUsd' in event ? event.costUsd : 0,
      'cycles' in event ? event.cycles : 0,
      'cycle' in event ? event.cycle : 0,
      'durationMs' in event ? event.durationMs : 0,
      'tokensIn' in event ? event.tokensIn : 0,
      'tokensOut' in event ? event.tokensOut : 0,
      'coldStart' in event ? (event.coldStart ? 1 : 0) : 0,
    ],
    indexes: [event.kind],
  });
}
