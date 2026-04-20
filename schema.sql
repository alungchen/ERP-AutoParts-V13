DROP TABLE IF EXISTS products;
CREATE TABLE products (
  p_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  car_models TEXT, 
  category TEXT,
  images TEXT, 
  part_numbers TEXT, 
  brand TEXT,
  stock INTEGER,
  specifications TEXT,
  safety_stock INTEGER,
  base_cost REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
