-- Zustand 快照（與 Downloads 專案一致）
CREATE TABLE IF NOT EXISTS store_snapshots (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
