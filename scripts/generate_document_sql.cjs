const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const masterCsv = path.join(OUTPUT_DIR, 'documents_master_sales.csv');
const detailCsv = path.join(OUTPUT_DIR, 'documents_detail_sales.csv');
const sqlFile = path.join(OUTPUT_DIR, 'import_documents.sql');

if (!fs.existsSync(masterCsv) || !fs.existsSync(detailCsv)) {
    console.error('找不到 CSV 檔案，請先執行爬蟲抓取資料。');
    process.exit(1);
}

function parseCSVRow(str) {
    let result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') {
            if (inQuote && str[i+1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (str[i] === ',' && !inQuote) {
            result.push(cur);
            cur = '';
        } else {
            cur += str[i];
        }
    }
    result.push(cur);
    return result;
}

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''); // 去除 BOM
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    const headers = parseCSVRow(lines[0]);
    const data = [];
    for(let i=1; i<lines.length; i++) {
        const row = parseCSVRow(lines[i]);
        const obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);
        data.push(obj);
    }
    return data;
}

const masters = parseCSV(masterCsv);
const details = parseCSV(detailCsv);

let sql = '';
sql += 'PRAGMA defer_foreign_keys = ON;\n';
sql += 'BEGIN TRANSACTION;\n\n';

sql += '-- 新增或更新主檔 --\n';
for (const m of masters) {
    const doc_id = m.doc_id.replace(/'/g, "''");
    const type = m.type.replace(/'/g, "''");
    const date = m.doc_date.replace(/'/g, "''");
    const customer = (m.customer_name || '').replace(/'/g, "''");
    const notes = (m.notes || '').replace(/'/g, "''");
    
    // 將爬下來的銷售單設為 completed 狀態
    sql += `INSERT OR REPLACE INTO documents (doc_id, type, date, customer_name, notes, status) VALUES ('${doc_id}', '${type}', '${date}', '${customer}', '${notes}', 'completed');\n`;
}

sql += '\n-- 刪除舊有明細 (避免重複匯入時出現重複項目) --\n';
for (const m of masters) {
    sql += `DELETE FROM document_items WHERE doc_id = '${m.doc_id.replace(/'/g, "''")}';\n`;
}

sql += '\n-- 寫入明細檔 --\n';
for (const d of details) {
    const doc_id = d.doc_id.replace(/'/g, "''");
    const part_id = (d.part_id || '').replace(/'/g, "''");
    const qty = parseFloat(d.quantity) || 0;
    const price = parseFloat(d.unit_price) || 0;
    
    if (!part_id) continue;

    // Schema 中的 p_id 是 NOT NULL。若目前沒有建立零件主檔，先使用 part_number 填入 p_id
    sql += `INSERT INTO document_items (doc_id, p_id, part_number, qty, unit_price) VALUES ('${doc_id}', '${part_id}', '${part_id}', ${qty}, ${price});\n`;
}

sql += '\nCOMMIT;\n';

fs.writeFileSync(sqlFile, sql, 'utf8');
console.log(`✅ 已經產生 SQL 檔案: ${sqlFile} (包含 ${masters.length} 筆主檔與 ${details.length} 筆明細)`);
