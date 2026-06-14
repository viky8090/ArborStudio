/**
 * AI Gateway client.
 *
 * In production, all LLM calls go through Cloudflare's AI Gateway. The binding is `env.AI`
 * (configured in wrangler.toml's [ai] block). The Container configures its LLM clients
 * to use the Gateway's base URL.
 *
 * Phase 0: simple pass-through; production adds:
 *   - Primary + fallback providers
 *   - Caching of identical prompts (5-min TTL)
 *   - Cost attribution per workspace
 *   - Latency budget enforcement
 *   - Per-workspace rate limit
 */

import type { Env } from '../index';

export interface GatewayRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  workspaceId: string;
  runId?: string;
  agent: 'coordinator' | 'executor';
}

export interface GatewayResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  cached: boolean;
  model: string;
}

const COST_PER_1K: Record<string, { in: number; out: number }> = {
  // Estimates; replaced by AI Gateway's own accounting in production
  'claude-sonnet-4-5': { in: 0.003, out: 0.015 },
  'claude-opus-4-5': { in: 0.015, out: 0.075 },
  'gpt-5': { in: 0.005, out: 0.015 },
  'gpt-5-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.005, out: 0.015 },
  'deepseek-chat': { in: 0.00027, out: 0.0011 },
};

export async function callLlm(req: GatewayRequest, env: Env): Promise<GatewayResponse> {
  // Production: use env.AI.run() with the appropriate model adapter
  // Phase 0: stub that returns a fixed response (the Container calls the real LLM
  // directly via the gateway URL passed in its start config)
  const fallback = COST_PER_1K[req.model] ?? { in: 0.001, out: 0.003 };
  void fallback; // referenced for the lookup; cost will come from AI Gateway in prod
  return {
    content: `[stub] You asked: ${req.messages.at(-1)?.content.slice(0, 100)}`,
    usage: { inputTokens: 0, outputTokens: 0 },
    costUsd: 0,
    cached: false,
    model: req.model,
  };
}
