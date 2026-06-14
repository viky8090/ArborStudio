import { z } from 'zod';

export const RunStatus = z.enum([
  'queued',
  'starting',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'stalled',
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const RunMode = z.enum(['auto', 'review', 'steer']);
export type RunMode = z.infer<typeof RunMode>;

export const LaunchRunBody = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1).max(120).default('Untitled run'),
  goal: z.string().min(1).max(2000),
  mode: RunMode.default('auto'),
  maxCycles: z.number().int().min(1).max(500).default(20),
  maxTurns: z.number().int().min(1).max(1000).default(100),
  plugin: z.string().optional(),
  pluginProfile: z.string().optional(),
  skills: z.array(z.string()).default([]),
  reasoningEffort: z.enum(['low', 'medium', 'high']).default('medium'),
  model: z.string().default('claude-sonnet-4-5'),
  budgetUsd: z.number().positive().max(10_000).optional(),
  configYaml: z.string().optional(),
});
export type LaunchRunBody = z.infer<typeof LaunchRunBody>;

export const RunSummary = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  workspaceId: z.string().optional(),
  name: z.string(),
  status: RunStatus,
  mode: RunMode,
  maxCycles: z.number().int(),
  maxTurns: z.number().int(),
  spentUsd: z.number().nullable(),
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  wsUrl: z.string().nullable(),
  createdAt: z.number(),
});
export type RunSummary = z.infer<typeof RunSummary>;
