-- =====================================================================
-- ERP-AutoParts-V13 多分店與多庫位資料庫遷移腳本 (第一階段)
-- 適用環境: Cloudflare D1 (SQLite)
-- 執行方式: wrangler d1 execute erp-db [--local | --remote] --file=./sql/migration_v13_to_multibranch.sql --yes
-- =====================================================================

-- 1. 建立分店表
CREATE TABLE IF NOT EXISTS branches (
  branch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 插入初始三家分店
INSERT OR IGNORE INTO branches (branch_id, name) VALUES ('songshan', '松山店');
INSERT OR IGNORE INTO branches (branch_id, name) VALUES ('xizhi', '汐止店');
INSERT OR IGNORE INTO branches (branch_id, name) VALUES ('linkou', '林口店');

-- 3. 建立庫存與庫位表
CREATE TABLE IF NOT EXISTS product_stock (
  p_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  location_code TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (p_id, branch_id, location_code),
  FOREIGN KEY (p_id) REFERENCES products(p_id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
);

-- 4. 遷移既有的庫存資料至「松山店 (songshan)」的 「A1」庫位
INSERT OR IGNORE INTO product_stock (p_id, branch_id, location_code, qty)
SELECT p_id, 'songshan', 'A1', COALESCE(stock, 0)
FROM products;

-- 5. 客戶表、供應商表、單據表新增分店關聯欄位，預設為 'songshan'
ALTER TABLE customers ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'songshan';
ALTER TABLE suppliers ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'songshan';
ALTER TABLE documents ADD COLUMN branch_id TEXT NOT NULL DEFAULT 'songshan';

-- 6. 移除產品表中的舊單一庫存欄位 (SQLite 3.35.0+ 支援 DROP COLUMN)
ALTER TABLE products DROP COLUMN stock;
