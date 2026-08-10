-- Zustand 快照（與 Downloads 專案一致）
CREATE TABLE IF NOT EXISTS store_snapshots (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shorthands (
  s_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  shorthand TEXT NOT NULL,
  fullname TEXT NOT NULL,
  meta_category TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
