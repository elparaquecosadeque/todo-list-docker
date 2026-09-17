CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_owner_hash ON todos (owner_hash);
