-- ArborStudio meta DB schema.
-- This DB is the source of truth for: tenants, users, sessions, workspaces,
-- members, billing, and workspace DEKs.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'researcher',  -- owner | admin | researcher | viewer
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                  -- jti
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS workspace_deks (
  id TEXT PRIMARY KEY,                  -- dek_<uuid>
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id),
  wrapped_dek BLOB NOT NULL,
  wrap_nonce BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,               -- google | github
  provider_sub TEXT NOT NULL,
  access_token_enc BLOB,                -- encrypted with the user's password-derived key
  refresh_token_enc BLOB,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_sub)
);
