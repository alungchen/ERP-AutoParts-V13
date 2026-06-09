-- =====================================================================
-- ERP-AutoParts-V13 單據品項欄位擴展 (新增庫位)
-- 適用環境: Cloudflare D1 (SQLite)
-- 執行方式: wrangler d1 execute erp-db [--local | --remote] --file=./sql/migration_add_document_items_location.sql --yes
-- =====================================================================

-- 1. 為 document_items 表新增 location_code 欄位，預設為 'A1'
ALTER TABLE document_items ADD COLUMN location_code TEXT DEFAULT 'A1';
