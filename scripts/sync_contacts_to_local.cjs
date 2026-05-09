// sync_contacts_to_local.cjs
// 從 output/ 資料夾讀取爬蟲產生的 CSV，
// 透過本機開發伺服器 API 把聯絡人資料注入到 localStorage JSON 檔，
// 讓本機瀏覽器一打開就能看到資料。
//
// 使用方式：node scripts/sync_contacts_to_local.cjs

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── CSV 解析引擎（與 ContactManager.jsx 相同邏輯）───
function parseCsv(csvText) {
    const lines = csvText.replace(/\uFEFF/, '').split(/\r?\n/);
    const rows = [];
    let partial = '';
    const parseLine = (line) => {
        const parts = [];
        let cell = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (inQ && line[i+1] === '"') { cell += '"'; i++; }
                else inQ = !inQ;
            } else if (c === ',' && !inQ) { parts.push(cell.trim()); cell = ''; }
            else cell += c;
        }
        parts.push(cell.trim());
        return parts;
    };
    for (const line of lines) {
        const full = partial ? partial + '\n' + line : line;
        const qCount = (full.match(/"/g) || []).length;
        if (qCount % 2 !== 0) { partial = full; }
        else { rows.push(parseLine(full)); partial = ''; }
    }
    return rows;
}

function normalizeHeader(h) {
    return (h || '').toLowerCase().replace(/^\uFEFF/, '').trim();
}

function mapContacts(csvPath, type) {
    if (!fs.existsSync(csvPath)) {
        console.log(`⚠️  找不到 ${csvPath}，跳過`);
        return [];
    }
    const text = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCsv(text);
    if (rows.length < 2) return [];

    const headers = rows[0].map(normalizeHeader);
    const map = {};
    headers.forEach((h, i) => map[h] = i);

    const getVal = (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) {
            const idx = map[normalizeHeader(k)];
            if (idx !== undefined && rows[0] && rows[1]) {
                // just check map is valid
            }
        }
        return (row) => {
            for (const k of arr) {
                const idx = map[normalizeHeader(k)];
                if (idx !== undefined && row[idx]) return row[idx];
            }
            return '';
        };
    };

    const gv = {
        rawId:          getVal(['cid', 'guid_id', 'id']),
        name:           getVal(['cname', 'name']),
        contact_name:   getVal(['cmainman', 'ccommman', 'contact']),
        resp_person:    getVal(['cmainman', 'ccommman']),
        email:          getVal(['cemail', 'ce_mail', 'email']),
        payment_terms:  getVal(['naccday', 'payment']),
        phone1:         getVal(['ctel1', 'tel1']),
        phone2:         getVal(['ctel2', 'tel2']),
        mobile:         getVal(['cacttel', 'mobile']),
        fax:            getVal(['cfax', 'fax']),
        tax_id:         getVal(['cgeneralno', 'taxid', 'tax_id']),
        invoice_title:  getVal(['cname2', 'invoice_title']),
        invoice_addr:   getVal(['cadd2', 'invoice_address']),
        zip_code:       getVal(['cpono', 'zip_code']),
        website:        getVal(['cwww', 'website']),
        closing_day:    getVal(['naccday', 'closing_day']),
        region_code:    getVal(['carea', 'region_code']),
        accounting_code:getVal(['service_id', 'accounting_code']),
        address:        getVal(['cadd1', 'address']),
        note:           getVal(['cnote']),
        ctype:          getVal(['ctype', 'category']),
        // customer-only
        delivery_addr:  getVal(['送貨地址', 'delivery_address']),
        collection_day: getVal(['收帳日', 'collection_day']),
        salesperson:    getVal(['csalesid', 'salesperson']),
        invm_check:     getVal(['invm_check']),
        clevel:         getVal(['clevel']),
    };

    const results = [];
    const seenIds = new Set();

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every(c => !c.trim())) continue;
        const rawId = gv.rawId(row);
        const name = gv.name(row);
        if (!name && !rawId) continue;

        let finalId = rawId || `LEGACY-${Date.now()}-${i}`;
        if (seenIds.has(finalId)) {
            // 如果代號重複，在後面加上流水號確保主鍵唯一
            finalId = `${finalId}-${i}`;
        }
        seenIds.add(finalId);

        const tax_id = gv.tax_id(row);
        const notes = [gv.note(row), tax_id ? `統編:${tax_id}` : ''].filter(Boolean).join(' | ');
        const categories = gv.ctype(row) ? [gv.ctype(row)] : [];

        const base = {
            name,
            contact_name: gv.contact_name(row),
            responsible_person: gv.resp_person(row),
            email: gv.email(row),
            payment_terms: gv.payment_terms(row),
            phone1: gv.phone1(row),
            phone2: gv.phone2(row),
            mobile: gv.mobile(row),
            fax: gv.fax(row),
            tax_id,
            invoice_title: gv.invoice_title(row),
            invoice_address: gv.invoice_addr(row),
            zip_code: gv.zip_code(row),
            website: gv.website(row),
            closing_day: gv.closing_day(row),
            region_code: gv.region_code(row),
            accounting_code: gv.accounting_code(row),
            address: gv.address(row),
            categories,
            notes,
            country: 'Taiwan',
            currency: 'TWD',
            rating: 0,
        };

        if (type === 'suppliers') {
            results.push({
                ...base,
                sup_id: finalId,
                supplier_code: rawId || '',
            });
        } else {
            results.push({
                ...base,
                cust_id: finalId,
                customer_code: rawId || '',
                delivery_address: gv.delivery_addr(row),
                collection_day: gv.collection_day(row),
                salesperson: gv.salesperson(row),
                full_invoice: gv.invm_check(row) === '1',
                tier: gv.clevel(row) || 'B',
                credit_limit: 0,
            });
        }
    }
    return results;
}

// ─── 主程式 ───
async function main() {
    const suppliers = mapContacts(path.join(OUTPUT_DIR, 'scraped_suppliers.csv'), 'suppliers');
    const customers = mapContacts(path.join(OUTPUT_DIR, 'scraped_customers.csv'), 'customers');

    console.log(`✅ 供應商: ${suppliers.length} 筆`);
    console.log(`✅ 客戶:   ${customers.length} 筆`);

    // 輸出為 JSON 讓瀏覽器可以直接載入
    const outPath = path.join(OUTPUT_DIR, 'contacts_seed.json');
    fs.writeFileSync(outPath, JSON.stringify({ suppliers, customers }, null, 2), 'utf8');
    console.log(`\n📁 已輸出: ${outPath}`);
    console.log(`\n📌 接下來請在 本機瀏覽器(localhost) 開啟 DevTools Console，貼上以下指令：`);
    console.log(`\n   fetch('/output/contacts_seed.json').then(r=>r.json()).then(d=>{`);
    console.log(`     const ss = JSON.parse(localStorage.getItem('erp-supplier-store')||'{}');`);
    console.log(`     ss.state = ss.state || {}; ss.state.suppliers = d.suppliers;`);
    console.log(`     localStorage.setItem('erp-supplier-store', JSON.stringify(ss));`);
    console.log(`     const cs = JSON.parse(localStorage.getItem('erp-customer-store')||'{}');`);
    console.log(`     cs.state = cs.state || {}; cs.state.customers = d.customers;`);
    console.log(`     localStorage.setItem('erp-customer-store', JSON.stringify(cs));`);
    console.log(`     location.reload();`);
    console.log(`   })`);
}

main().catch(console.error);
