-- optimize branch queries
CREATE INDEX IF NOT EXISTS idx_documents_branch_id ON documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_branch_id ON suppliers(branch_id);
