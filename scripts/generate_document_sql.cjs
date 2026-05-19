const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const sqlFile = path.join(OUTPUT_DIR, 'import_documents.sql');

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
    if (!fs.existsSync(filePath)) return [];
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

// 掃描 output 目錄下的所有 documents_master_*.csv 檔案
const files = fs.readdirSync(OUTPUT_DIR);
const masterFiles = files.filter(f => f.startsWith('documents_master_') && f.endsWith('.csv'));

if (masterFiles.length === 0) {
    console.error('找不到任何 documents_master_*.csv 檔案，請先執行爬蟲抓取資料。');
    process.exit(1);
}

let sql = '';
sql += 'PRAGMA defer_foreign_keys = ON;\n\n';

let totalMasters = 0;
let totalDetails = 0;

for (const masterFile of masterFiles) {
    // 從檔名提取單據類型，例如 documents_master_sales.csv -> sales
    const type = masterFile.replace('documents_master_', '').replace('.csv', '');
    const detailFile = `documents_detail_${type}.csv`;
    
    const masterPath = path.join(OUTPUT_DIR, masterFile);
    const detailPath = path.join(OUTPUT_DIR, detailFile);
    
    if (!fs.existsSync(detailPath)) {
        console.warn(`⚠️ 警告: 發現主檔 ${masterFile} 但找不到對應的明細檔 ${detailFile}，跳過此類型。`);
        continue;
    }
    
    console.log(`正在處理單據類型: ${type}...`);
    const masters = parseCSV(masterPath);
    const details = parseCSV(detailPath);
    
    totalMasters += masters.length;
    totalDetails += details.length;
    
    // 區分採購類（寫入 supplier_name）與銷售類（寫入 customer_name）
    const isProcurement = ['purchase', 'purchaseReturn', 'inquiry', 'po'].includes(type);
    const partyColumn = isProcurement ? 'supplier_name' : 'customer_name';
    
    sql += `-- === 新增或更新主檔 [${type}] === --\n`;
    for (const m of masters) {
        const doc_id = m.doc_id.replace(/'/g, "''");
        const doc_type = m.type.replace(/'/g, "''");
        const date = m.doc_date.replace(/'/g, "''");
        const partyName = (m.customer_name || '').replace(/'/g, "''");
        const notes = (m.notes || '').replace(/'/g, "''");
        
        sql += `INSERT OR REPLACE INTO documents (doc_id, type, date, ${partyColumn}, notes, status) VALUES ('${doc_id}', '${doc_type}', '${date}', '${partyName}', '${notes}', 'completed');\n`;
    }
    
    sql += `\n-- === 刪除舊有明細 [${type}] === --\n`;
    for (const m of masters) {
        sql += `DELETE FROM document_items WHERE doc_id = '${m.doc_id.replace(/'/g, "''")}';\n`;
    }
    
    sql += `\n-- === 寫入明細檔 [${type}] === --\n`;
    for (const d of details) {
        const doc_id = d.doc_id.replace(/'/g, "''");
        const part_id = (d.part_id || '').replace(/'/g, "''");
        const qty = parseFloat(d.quantity) || 0;
        const price = parseFloat(d.unit_price) || 0;
        
        if (!part_id) continue;
        
        sql += `INSERT INTO document_items (doc_id, p_id, part_number, qty, unit_price) VALUES ('${doc_id}', '${part_id}', '${part_id}', ${qty}, ${price});\n`;
    }
    sql += '\n';
}

fs.writeFileSync(sqlFile, sql, 'utf8');
console.log(`\n✅ 已經產生 SQL 檔案: ${sqlFile}`);
console.log(`   共處理了 ${masterFiles.length} 種單據類型，包含 ${totalMasters} 筆主檔與 ${totalDetails} 筆明細。`);
