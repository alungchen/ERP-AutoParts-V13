// sync_contacts_from_remote.cjs
// 以遠端 D1 為主，下載到本機 D1（與 import_to_local.cjs 的產品同步邏輯相同）
const Database = require('better-sqlite3');
const https = require('https');
const path = require('path');
const fs = require('fs');

const SQLITE_PATH = path.join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0e60851c1998f7cdba4eb76d90199a126f73717e31028bf264f293c89f60e07e.sqlite');
const BASE_URL = 'https://erp-autoparts-v13.pages.dev';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error: ' + data.substring(0, 100))); }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('📡 從遠端下載聯絡人資料...');
    const [suppliers, customers] = await Promise.all([
        fetchJson(`${BASE_URL}/api/suppliers`),
        fetchJson(`${BASE_URL}/api/customers`),
    ]);
    console.log(`   供應商: ${suppliers.length} 筆`);
    console.log(`   客戶:   ${customers.length} 筆`);

    console.log('\n🔧 開啟本機 D1...');
    const db = new Database(SQLITE_PATH);

    // 確保資料表存在
    db.exec(fs.readFileSync(path.join(__dirname, '../schema_contacts.sql'), 'utf8'));

    // ── 供應商 ──
    db.exec('DELETE FROM suppliers');
    const supStmt = db.prepare(`
        INSERT OR REPLACE INTO suppliers
        (sup_id, supplier_code, name, contact_name, responsible_person, email,
         payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
         zip_code, website, closing_day, region_code, accounting_code, address,
         country, currency, categories, rating, notes, tier, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertSup = db.transaction((rows) => {
        for (const s of rows) {
            supStmt.run(
                s.sup_id, s.supplier_code||'', s.name||'', s.contact_name||'', s.responsible_person||'',
                s.email||'', s.payment_terms||'', s.phone1||'', s.phone2||'', s.mobile||'', s.fax||'',
                s.tax_id||'', s.invoice_title||'', s.invoice_address||'', s.zip_code||'', s.website||'',
                s.closing_day||'', s.region_code||'', s.accounting_code||'', s.address||'',
                s.country||'Taiwan', s.currency||'TWD',
                JSON.stringify(s.categories||[]), s.rating||0, s.notes||'', s.tier||'B',
                s.updated_at||''
            );
        }
    });
    insertSup(suppliers);

    // ── 客戶 ──
    db.exec('DELETE FROM customers');
    const custStmt = db.prepare(`
        INSERT OR REPLACE INTO customers
        (cust_id, customer_code, name, contact_name, responsible_person, email,
         payment_terms, phone1, phone2, mobile, fax, tax_id, invoice_title, invoice_address,
         zip_code, website, closing_day, collection_day, region_code, accounting_code, address,
         delivery_address, salesperson, full_invoice, country, currency, tier, credit_limit, notes, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertCust = db.transaction((rows) => {
        for (const c of rows) {
            custStmt.run(
                c.cust_id, c.customer_code||'', c.name||'', c.contact_name||'', c.responsible_person||'',
                c.email||'', c.payment_terms||'', c.phone1||'', c.phone2||'', c.mobile||'', c.fax||'',
                c.tax_id||'', c.invoice_title||'', c.invoice_address||'', c.zip_code||'', c.website||'',
                c.closing_day||'', c.collection_day||'', c.region_code||'', c.accounting_code||'',
                c.address||'', c.delivery_address||'', c.salesperson||'', c.full_invoice ? 1 : 0,
                c.country||'Taiwan', c.currency||'TWD', c.tier||'B', c.credit_limit||0, c.notes||'',
                c.updated_at||''
            );
        }
    });
    insertCust(customers);

    const supCnt = db.prepare('SELECT count(*) as c FROM suppliers').get();
    const custCnt = db.prepare('SELECT count(*) as c FROM customers').get();
    db.close();

    console.log('\n✅ 本機 D1 同步完成！');
    console.log(`   供應商: ${supCnt.c} 筆`);
    console.log(`   客戶:   ${custCnt.c} 筆`);
}

main().catch(console.error);
