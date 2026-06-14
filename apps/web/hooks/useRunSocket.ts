/**
 * WebSocket client for live run events.
 * Connects to the RunDO via the Worker upgrade endpoint, with auto-reconnect.
 *
 *   const socket = useRunSocket(runId, {
 *     onEvent: (evt) => console.log(evt),
 *     onOpen: () => console.log('open'),
 *     onClose: () => console.log('close'),
 *   });
 */

'use client';

import { useEffect, useRef } from 'react';
import { wsUrl } from '@/lib/api';

export type RunEvent = {
  v: 1;
  type: string;
  ts: number;
  seq?: number;
  run_id: string;
  data: Record<string, unknown>;
};

export type RunSocketOptions = {
  topics?: string[];
  onEvent?: (evt: RunEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
  autoReconnect?: boolean;
};

export function useRunSocket(runId: string, opts: RunSocketOptions = {}): WebSocket | null {
  const wsRef = useRef<WebSocket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    function connect() {
      // In production, the token is a short-lived JWT fetched from /api/v1/runs/:rid/ws-token
      const url = `${wsUrl(`/api/v1/runs/${runId}/ws`)}?token=dev-test-token`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (optsRef.current.topics) {
          ws.send(JSON.stringify({ type: 'subscribe', topics: optsRef.current.topics }));
        }
        optsRef.current.onOpen?.();
      });
      ws.addEventListener('message', (e) => {
        try {
          const evt = JSON.parse((e as MessageEvent).data as string) as RunEvent;
          optsRef.current.onEvent?.(evt);
        } catch {
          // ignore malformed
        }
      });
      ws.addEventListener('close', () => {
        optsRef.current.onClose?.();
        if (!cancelled && optsRef.current.autoReconnect !== false) {
          setTimeout(connect, 2_000);
        }
      });
      ws.addEventListener('error', (e) => {
        optsRef.current.onError?.(e);
      });
    }

    connect();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [runId]);

  return wsRef.current;
}
