import { z } from 'zod';

/**
 * Canonical event shape.
 * Mirrors Arbor's internal event format and adds a `v` (protocol version)
 * and `seq` (monotonic, assigned by the DO).
 */

export const EventFrame = z.object({
  v: z.literal(1),
  type: z.string(),
  ts: z.number(),
  seq: z.number().int().nonnegative().optional(),
  run_id: z.string(),
  data: z.record(z.unknown()).default({}),
});
export type EventFrame = z.infer<typeof EventFrame>;

export const EventType = z.enum([
  'run.started',
  'run.completed',
  'run.failed',
  'run.cancelled',
  'cycle.started',
  'cycle.completed',
  'tree.node.added',
  'tree.node.updated',
  'tree.node.pruned',
  'tree.node.merged',
  'idea.proposed',
  'evidence.recorded',
  'insight.abstracted',
  'cost.tick',
  'log.line',
  'status.changed',
  'error.raised',
]);
export type EventType = z.infer<typeof EventType>;

// Client -> Server frames
export const ClientFrame = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('subscribe'), topics: z.array(z.string()) }),
  z.object({
    type: z.literal('slash.command'),
    name: z.string(),
    args: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal('hitl.respond'),
    node_id: z.string(),
    decision: z.enum(['approve', 'reject']),
    rationale: z.string().optional(),
  }),
  z.object({ type: z.literal('steer'), text: z.string().min(1).max(2000) }),
  z.object({ type: z.literal('seek_event_seq'), seq: z.number().int().nonnegative() }),
]);
export type ClientFrame = z.infer<typeof ClientFrame>;
