-- ArborStudio per-workspace DB schema.
-- In production, this lives in a separate D1 database per workspace.
-- For local dev, all workspaces share DB_WS_DEFAULT.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  repo_url TEXT,
  tarball_key TEXT,                    -- R2 key for uploaded tarball
  default_branch TEXT DEFAULT 'main',
  baseline_metric REAL,
  intake_config_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_projects_ws_updated ON projects(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_ws_active ON projects(workspace_id, deleted_at);

CREATE TABLE IF NOT EXISTS project_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  yaml TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_configs_project ON project_configs(project_id, version DESC);

CREATE TABLE IF NOT EXISTS project_secrets (
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,               -- anthropic | openai | litellm | custom
  dek_id TEXT NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  base_url TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,                 -- queued | starting | running | paused | completed | failed | cancelled | stalled
  mode TEXT NOT NULL,                   -- auto | review | steer
  max_cycles INTEGER NOT NULL,
  max_turns INTEGER NOT NULL,
  plugin TEXT,
  plugin_profile TEXT,
  skills TEXT,                          -- JSON array
  reasoning_effort TEXT,
  model TEXT,
  budget_usd REAL,
  spent_usd REAL DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER,
  do_id TEXT NOT NULL,
  container_id TEXT,
  ws_url TEXT,
  latest_tree_snapshot_key TEXT,
  report_key TEXT,
  last_event_seq INTEGER DEFAULT 0,
  config_snapshot_yaml TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_ws_status ON runs(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_container ON runs(container_id);

CREATE TABLE IF NOT EXISTS tree_nodes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id),
  parent_id TEXT,
  depth INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,                 -- pending | running | merged | pruned | done | failed
  score REAL,
  insight TEXT,
  branch TEXT,
  cycle INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tree_run_parent ON tree_nodes(run_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_tree_run_status ON tree_nodes(run_id, status);
CREATE INDEX IF NOT EXISTS idx_tree_run_cycle  ON tree_nodes(run_id, cycle);
CREATE INDEX IF NOT EXISTS idx_tree_ws_updated ON tree_nodes(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id),
  node_id TEXT NOT NULL REFERENCES tree_nodes(id),
  cycle INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL,
  dev_value REAL,
  held_out_value REAL,
  margin REAL,
  log_key TEXT,
  artifact_keys_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON evidence(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_node ON evidence(node_id);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  yaml TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_plugins_ws ON plugins(workspace_id, name);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  front_matter_json TEXT,
  markdown TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (workspace_id, name)
);
CREATE INDEX IF NOT EXISTS idx_skills_ws ON skills(workspace_id, name);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,                   -- slack | github | linear | webhook
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_integrations_ws ON integrations(workspace_id, kind);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  run_id TEXT REFERENCES runs(id),
  day TEXT NOT NULL,                    -- YYYY-MM-DD
  model TEXT NOT NULL,
  agent TEXT NOT NULL,                  -- coordinator | executor
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_ws_day_model ON usage_records(workspace_id, day, model);
CREATE INDEX IF NOT EXISTS idx_usage_run ON usage_records(run_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  stripe_invoice_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_ws ON invoices(workspace_id, period_start);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  payload_json TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_log(workspace_id, ts DESC);
