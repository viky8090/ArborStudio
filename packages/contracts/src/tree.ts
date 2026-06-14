import { z } from 'zod';

export const TreeNodeStatus = z.enum(['pending', 'running', 'merged', 'pruned', 'done', 'failed']);
export type TreeNodeStatus = z.infer<typeof TreeNodeStatus>;

export const TreeNode = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  depth: z.number().int().min(0),
  title: z.string(),
  status: TreeNodeStatus,
  score: z.number().nullable(),
  insight: z.string().nullable(),
  branch: z.string().nullable(),
  evidence_json: z.string().nullable(),
  cycle: z.number().int().min(0),
  created_at: z.number(),
  updated_at: z.number(),
});
export type TreeNode = z.infer<typeof TreeNode>;

export const TreeSnapshot = z.object({
  nodes: z.array(TreeNode),
  fetchedAt: z.number().optional(),
});
export type TreeSnapshot = z.infer<typeof TreeSnapshot>;
