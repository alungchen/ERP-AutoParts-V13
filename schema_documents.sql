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

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_document_items_doc_id ON document_items(doc_id);
