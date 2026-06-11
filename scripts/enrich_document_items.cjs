/**
 * enrich_document_items.cjs
 * 從遠端 D1 products 資料庫，依 p_id 補齊本地 document_items 的 name / note 欄位
 *
 * 使用方式:
 *   node scripts/enrich_document_items.cjs [--doc-ids=2S2512310001,2S2512310002,...] [--all-local] [--dry-run]
 *
 * 邏輯:
 *   1. 從本地 document_items 取出所有 p_id（或指定 doc_id 的 p_id）
 *   2. 批次查遠端 D1 products 取得 name, brand, car_models, part_numbers
 *   3. 產生 SQL UPDATE，更新本地 document_items:
 *      - name     = 品名（products.name）如果目前空白才更新
 *      - note     = 保留原有 note，追加車型/年份 (若 note 中未含)
 *      另外在 name 末尾加上品牌（若 brand 不在 name 中）
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allLocal = args.includes('--all-local');
const docIdsArg = args.find(a => a.startsWith('--doc-ids='))?.split('=')[1];
const docIds = docIdsArg ? docIdsArg.split(',').map(s => s.trim()) : null;

function runD1(target, sql) {
    const cmd = `npx wrangler d1 execute erp-db ${target} --command="${sql.replace(/"/g, '\\"')}" --json`;
    try {
        const out = execSync(cmd, { encoding: 'utf8', cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'ignore'] });
        const parsed = JSON.parse(out);
        return parsed[0]?.results || [];
    } catch (e) {
        console.error('D1 query failed:', e.message?.slice(0, 200));
        return [];
    }
}

function sqlStr(s) {
    if (s === null || s === undefined) return 'NULL';
    return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── Step 1: 取本地 document_items 的 p_id 清單 ──────────
console.log('\n📋 查詢本地 document_items...');
let whereClause = '';
if (docIds && docIds.length > 0) {
    whereClause = `WHERE doc_id IN (${docIds.map(id => `'${id}'`).join(',')})`;
} else if (!allLocal) {
    // 預設：只處理從日報 XLS 匯入的汐止單據（doc_id 以 2 開頭）
    whereClause = "WHERE doc_id LIKE '2%'";
}

const localItems = runD1('--local', `SELECT DISTINCT p_id, name, note FROM document_items ${whereClause}`);
console.log(`   找到 ${localItems.length} 筆唯一 p_id`);

if (localItems.length === 0) {
    console.log('❌ 本地沒有符合的 document_items，請確認 --doc-ids 或 --all-local 參數');
    process.exit(0);
}

// ── Step 2: 批次查遠端 products ──────────────────────────
const uniquePIds = [...new Set(localItems.map(r => r.p_id))].filter(Boolean);
console.log(`\n🌐 從遠端查詢 ${uniquePIds.length} 個零件號碼...`);

// 每次最多查 50 個避免 SQL 太長
const CHUNK = 50;
const productMap = new Map(); // p_id → { name, brand, car_model, year }

for (let i = 0; i < uniquePIds.length; i += CHUNK) {
    const chunk = uniquePIds.slice(i, i + CHUNK);
    const inClause = chunk.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const rows = runD1('--remote', `SELECT p_id, name, brand, car_models, part_numbers FROM products WHERE p_id IN (${inClause})`);
    
    for (const row of rows) {
        // 解析 car_models JSON
        let carModel = '';
        let year = '';
        try {
            const cms = JSON.parse(row.car_models || '[]');
            if (Array.isArray(cms) && cms.length > 0) {
                const cm0 = cms[0];
                carModel = (typeof cm0 === 'string' ? cm0 : cm0?.model) || '';
                year = (typeof cm0 === 'object' ? cm0?.year : '') || '';
            }
        } catch {}

        // 優先從 part_numbers 的 pn_id=..._1 (主要適用) 取車型
        try {
            const pns = JSON.parse(row.part_numbers || '[]');
            if (Array.isArray(pns) && pns.length > 0) {
                const pn0 = pns[0];
                if (pn0.car_model) carModel = pn0.car_model;
                if (pn0.year) year = pn0.year;
            }
        } catch {}

        productMap.set(row.p_id, {
            name: row.name || '',
            brand: row.brand || '',
            carModel,
            year,
        });
    }
    process.stdout.write(`   查詢進度: ${Math.min(i + CHUNK, uniquePIds.length)}/${uniquePIds.length}\r`);
}
console.log(`\n   ✅ 找到 ${productMap.size}/${uniquePIds.length} 筆零件資料`);

// ── Step 3: 產生 UPDATE SQL ──────────────────────────────
const sqlLines = [];
sqlLines.push('-- enrich_document_items: 補齊 name/note 欄位');
sqlLines.push(`-- 產生時間: ${new Date().toISOString()}`);
sqlLines.push('');

let updateCount = 0;
let notFoundCount = 0;

// 取所有需要更新的明細（含 item_id）
const allItems = runD1('--local', `SELECT item_id, doc_id, p_id, name, note FROM document_items ${whereClause}`);

for (const item of allItems) {
    const prod = productMap.get(item.p_id);
    if (!prod) {
        notFoundCount++;
        continue;
    }

    // 組合新 name: 品名 + 品牌（若品牌未在品名中）
    let newName = item.name || prod.name || '';
    if (prod.brand && !newName.includes(prod.brand)) {
        newName = newName ? `${newName} ${prod.brand}` : prod.brand;
    }
    // 若 name 本來是空的才用 products.name
    if (!item.name && prod.name) {
        newName = prod.brand ? `${prod.name} ${prod.brand}` : prod.name;
    }

    // 組合新 note: 優先使用 XLS 帶來的車型（note 已包含），
    // 若 note 是空的才從 products 補
    const existingNote = item.note || '';
    let newNote = existingNote;
    if (!existingNote && prod.carModel) {
        newNote = prod.year ? `${prod.carModel} ${prod.year}` : prod.carModel;
    }

    // 是否有變化
    const nameChanged = newName !== (item.name || '');
    const noteChanged = newNote !== existingNote;

    if (!nameChanged && !noteChanged) continue;

    const setParts = [];
    if (nameChanged) setParts.push(`name = ${sqlStr(newName)}`);
    if (noteChanged) setParts.push(`note = ${sqlStr(newNote)}`);

    sqlLines.push(`UPDATE document_items SET ${setParts.join(', ')} WHERE item_id = ${item.item_id};`);
    updateCount++;
}

sqlLines.push('');
sqlLines.push(`-- 合計: ${updateCount} 筆更新, ${notFoundCount} 筆零件不在遠端資料庫`);

// ── 輸出 & 執行 ──────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const sqlFile = path.join(outDir, 'enrich_document_items.sql');
fs.writeFileSync(sqlFile, sqlLines.join('\n'), 'utf8');
console.log(`\n📄 SQL 已產生: ${sqlFile} (${updateCount} 筆 UPDATE)`);

if (dryRun) {
    console.log('\n🔍 Dry-run 模式，前 20 行 SQL:');
    sqlLines.slice(0, 20).forEach(l => console.log('  ' + l));
    console.log('\n⏭️  未實際寫入，加上 --local 執行可立即套用');
    process.exit(0);
}

if (updateCount === 0) {
    console.log('\n✅ 沒有需要更新的欄位（全部已有資料）');
    process.exit(0);
}

console.log('\n🚀 套用到本地資料庫...');
try {
    execSync(`npx wrangler d1 execute erp-db --local --file="${sqlFile}" --yes`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log('\n✅ 補齊完成！請重新整理瀏覽器。');
} catch (err) {
    console.error('❌ 套用失敗:', err.message);
}
