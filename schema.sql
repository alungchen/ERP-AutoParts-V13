-- 分店表
CREATE TABLE IF NOT EXISTS branches (
  branch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 產品主檔表 (無單一 stock 欄位)
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  p_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  car_models TEXT, 
  category TEXT,
  images TEXT, 
  part_numbers TEXT, 
  brand TEXT,
  specifications TEXT,
  safety_stock INTEGER,
  base_cost REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 庫存與庫位關聯表
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

