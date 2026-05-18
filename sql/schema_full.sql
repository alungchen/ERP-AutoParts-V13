-- 從雲端同步的完整 Schema
CREATE TABLE IF NOT EXISTS products (
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

CREATE TABLE IF NOT EXISTS suppliers (
  sup_id TEXT PRIMARY KEY,
  supplier_code TEXT,
  name TEXT NOT NULL DEFAULT '',
  contact_name TEXT DEFAULT '',
  responsible_person TEXT DEFAULT '',
  email TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  phone1 TEXT DEFAULT '',
  phone2 TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  fax TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  invoice_title TEXT DEFAULT '',
  invoice_address TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  website TEXT DEFAULT '',
  closing_day TEXT DEFAULT '',
  region_code TEXT DEFAULT '',
  accounting_code TEXT DEFAULT '',
  address TEXT DEFAULT '',
  country TEXT DEFAULT 'Taiwan',
  currency TEXT DEFAULT 'TWD',
  categories TEXT DEFAULT '[]',
  rating REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  tier TEXT DEFAULT 'B',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  cust_id TEXT PRIMARY KEY,
  customer_code TEXT,
  name TEXT NOT NULL DEFAULT '',
  contact_name TEXT DEFAULT '',
  responsible_person TEXT DEFAULT '',
  email TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  phone1 TEXT DEFAULT '',
  phone2 TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  fax TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  invoice_title TEXT DEFAULT '',
  invoice_address TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  website TEXT DEFAULT '',
  closing_day TEXT DEFAULT '',
  collection_day TEXT DEFAULT '',
  region_code TEXT DEFAULT '',
  accounting_code TEXT DEFAULT '',
  address TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  salesperson TEXT DEFAULT '',
  full_invoice INTEGER DEFAULT 0,
  country TEXT DEFAULT 'Taiwan',
  currency TEXT DEFAULT 'TWD',
  tier TEXT DEFAULT 'B',
  credit_limit REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS erp_stores (
  store_key TEXT PRIMARY KEY,
  store_value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  opener_emp_id TEXT,
  opener_emp_name TEXT,
  notes TEXT,
  currency TEXT DEFAULT 'TWD',
  exchange_rate REAL DEFAULT 1.0,
  discount REAL DEFAULT 0,
  freight_cost REAL DEFAULT 0,
  tariff_rate REAL DEFAULT 0,
  customer_id TEXT,
  customer_name TEXT,
  supplier_id TEXT,
  supplier_name TEXT,
  due_date TEXT,
  expected_date TEXT,
  valid_until TEXT,
  quotation_ref TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  p_id TEXT NOT NULL,
  name TEXT,
  part_number TEXT,
  qty REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  unit TEXT DEFAULT 'PCS',
  note TEXT,
  FOREIGN KEY(doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
);
