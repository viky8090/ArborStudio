import { z } from 'zod';

// ----- Workspace -----
export const CreateWorkspaceBody = z.object({ name: z.string().min(1).max(80).trim() });
export type CreateWorkspaceBody = z.infer<typeof CreateWorkspaceBody>;

// ----- Project -----
export const CreateProjectBody = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1).max(120).trim(),
  repoUrl: z.string().url().optional(),
  defaultBranch: z.string().default('main'),
  baselineMetric: z.number().optional(),
});
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

// ----- Plugin -----
export const PluginYaml = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().min(1).max(200),
  yaml: z.string().min(1).max(64_000),
});
export type PluginYaml = z.infer<typeof PluginYaml>;

// ----- Skill -----
export const SkillMarkdown = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  description: z.string().min(1).max(200),
  frontMatter: z.record(z.unknown()).default({}),
  markdown: z.string().min(1).max(64_000),
});
export type SkillMarkdown = z.infer<typeof SkillMarkdown>;

// ----- LLM Key -----
export const LlmProvider = z.enum(['anthropic', 'openai', 'litellm', 'custom']);
export type LlmProvider = z.infer<typeof LlmProvider>;

export const SaveLlmKeyBody = z.object({
  provider: LlmProvider,
  apiKey: z.string().min(1).max(1000),
  baseUrl: z.string().url().optional(),
});
export type SaveLlmKeyBody = z.infer<typeof SaveLlmKeyBody>;

// ----- Internal: Container handshake -----
export const ContainerHandshake = z.object({
  runId: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  sid: z.string(),
  configYaml: z.string().optional(),
  llmKeys: z.record(z.string()).optional(), // provider -> plaintext API key
});
export type ContainerHandshake = z.infer<typeof ContainerHandshake>;
