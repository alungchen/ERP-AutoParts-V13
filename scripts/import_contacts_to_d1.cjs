// import_contacts_to_d1.cjs
// 把 contacts_seed.json 的供應商/客戶資料批次寫入本機或遠端 D1
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0e60851c1998f7cdba4eb76d90199a126f73717e31028bf264f293c89f60e07e.sqlite');
const SEED_FILE = path.join(__dirname, '../output/contacts_seed.json');

if (!fs.existsSync(SEED_FILE)) {
    console.error('❌ 找不到 output/contacts_seed.json，請先執行: node scripts/sync_contacts_to_local.cjs');
    process.exit(1);
}

const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
const db = new Database(SQLITE_PATH);

// 建立資料表（若不存在）
db.exec(fs.readFileSync(path.join(__dirname, '../schema_contacts.sql'), 'utf8'));

// ── 匯入供應商 ──
console.log(`📦 匯入供應商 ${seed.suppliers.length} 筆...`);
db.exec('DELETE FROM suppliers');
const supStmt = db.prepare(`
    INSERT OR REPLACE INTO suppliers
    (sup_id, supplier_code, name, contact_name, responsible_person, email,
     payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
     zip_code, website, closing_day, region_code, accounting_code, address,
     country, currency, categories, rating, notes, tier, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
`);
const insertSuppliers = db.transaction((rows) => {
    for (const s of rows) {
        supStmt.run(
            s.sup_id, s.supplier_code||'', s.name||'', s.contact_name||'', s.responsible_person||'',
            s.email||'', s.payment_terms||'', s.phone1||'', s.phone2||'', s.mobile||'', s.fax||'',
            s.tax_id||'', s.invoice_title||'', s.invoice_address||'', s.zip_code||'', s.website||'',
            s.closing_day||'', s.region_code||'', s.accounting_code||'', s.address||'',
            s.country||'Taiwan', s.currency||'TWD',
            JSON.stringify(s.categories||[]), s.rating||0, s.notes||'', s.tier||'B'
        );
    }
});
insertSuppliers(seed.suppliers);

// ── 匯入客戶 ──
console.log(`📦 匯入客戶 ${seed.customers.length} 筆...`);
db.exec('DELETE FROM customers');
const custStmt = db.prepare(`
    INSERT OR REPLACE INTO customers
    (cust_id, customer_code, name, contact_name, responsible_person, email,
     payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
     zip_code, website, closing_day, collection_day, region_code, accounting_code, address,
     delivery_address, salesperson, full_invoice, country, currency, tier, credit_limit, notes, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
`);
const insertCustomers = db.transaction((rows) => {
    for (const c of rows) {
        custStmt.run(
            c.cust_id, c.customer_code||'', c.name||'', c.contact_name||'', c.responsible_person||'',
            c.email||'', c.payment_terms||'', c.phone1||'', c.phone2||'', c.mobile||'', c.fax||'',
            c.tax_id||'', c.invoice_title||'', c.invoice_address||'', c.zip_code||'', c.website||'',
            c.closing_day||'', c.collection_day||'', c.region_code||'', c.accounting_code||'',
            c.address||'', c.delivery_address||'', c.salesperson||'', c.full_invoice ? 1 : 0,
            c.country||'Taiwan', c.currency||'TWD', c.tier||'B', c.credit_limit||0, c.notes||''
        );
    }
});
insertCustomers(seed.customers);

const supCount = db.prepare('SELECT count(*) as cnt FROM suppliers').get();
const custCount = db.prepare('SELECT count(*) as cnt FROM customers').get();
console.log(`\n✅ 本機 D1 匯入完成！`);
console.log(`   供應商: ${supCount.cnt} 筆`);
console.log(`   客戶:   ${custCount.cnt} 筆`);
db.close();
