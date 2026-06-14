import { z } from 'zod';

export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type User = z.infer<typeof User>;

export const Workspace = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().optional(),
  plan: z.string().optional(),
});
export type Workspace = z.infer<typeof Workspace>;

export const SignupBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(80).trim(),
  turnstileToken: z.string().min(1),
});
export type SignupBody = z.infer<typeof SignupBody>;

export const LoginBody = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(128),
  turnstileToken: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const Project = z.object({
  id: z.string(),
  workspaceId: z.string().optional(),
  name: z.string(),
  repoUrl: z.string().url().optional().nullable(),
  defaultBranch: z.string().default('main'),
  baselineMetric: z.number().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Project = z.infer<typeof Project>;
