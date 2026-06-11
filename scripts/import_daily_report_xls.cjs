/**
 * import_daily_report_xls.cjs
 * 從「日報明細表」XLS 檔案匯入單據資料到 ERP 資料庫
 *
 * 【一般用法】:
 *   1. 把 XLS 改名為 list_to_upload.xls 放到專案根目錄
 *   2. node scripts/import_daily_report_xls.cjs --branch=xizhi --remote
 *
 * 【進階用法（自訂檔案路徑）】:
 *   node scripts/import_daily_report_xls.cjs --file="D:\Downloads\20251231.xls" --branch=xizhi --remote
 *
 * 單別對應:
 *   銷貨 → sales        (documents.type = 'sales',         customer_name)
 *   銷退 → salesReturn  (documents.type = 'salesReturn',   customer_name)
 *   進貨 → purchase     (documents.type = 'purchase',      supplier_name)
 *   進退 → purchaseReturn (documents.type = 'purchaseReturn', supplier_name)
 *
 * XLS 欄位對應（0-indexed）:
 *   col[0]  → 單號  doc_id
 *   col[3]  → 對象  customer_name / supplier_name
 *   col[5]  → 交易日期  date
 *   col[9]  → 單別  type
 *   col[10] → 零件號碼  p_id (去除開頭的 ')
 *   col[13] → 車種年份  (存入 note)
 *   col[15] → 品名規格  name
 *   col[18] → 數量  qty  (實際索引 = 17+1 因有合併儲存格)
 *   col[20] → 實價  unit_price
 *   col[21] → 小計  subtotal
 *   col[22] → 備註  note
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { execSync } = require('child_process');

// ── 解析命令列參數 ───────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (prefix) => args.find(a => a.startsWith(prefix))?.split('=').slice(1).join('=');

// 預設讀取專案根目錄的 list_to_upload.xls
const DEFAULT_XLS = path.join(__dirname, '..', 'list_to_upload.xls');
const branchArg = getArg('--branch=') || 'xizhi';
const dryRun    = args.includes('--dry-run');
const remote    = args.includes('--remote');

const ALLOWED_BRANCHES = ['songshan', 'xizhi', 'linkou'];
if (!ALLOWED_BRANCHES.includes(branchArg)) {
  console.error(`❌ 未知的分店代號: ${branchArg}。支援: ${ALLOWED_BRANCHES.join(', ')}`);
  process.exit(1);
}

// 取得所有待處理的 XLS 檔案
let filesToProcess = [];

const fileArg = getArg('--file=');
if (fileArg) {
  // 檢查是否為多個逗號分隔的檔案
  if (fileArg.includes(',')) {
    const parts = fileArg.split(',').map(f => f.trim()).filter(Boolean);
    for (const f of parts) {
      const absPath = path.resolve(f);
      if (fs.existsSync(absPath)) {
        filesToProcess.push(absPath);
      } else {
        console.warn(`⚠️ 找不到指定檔案，將跳過: ${f}`);
      }
    }
  } else {
    const absPath = path.resolve(fileArg);
    if (fs.existsSync(absPath)) {
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        // 如果是目錄，尋找目錄下所有的 xls 或 xlsx 檔
        console.log(`📂 偵測到目錄: ${absPath}，正在搜尋 Excel 檔案...`);
        const files = fs.readdirSync(absPath);
        for (const file of files) {
          if ((file.endsWith('.xls') || file.endsWith('.xlsx')) && !file.startsWith('~$')) {
            filesToProcess.push(path.join(absPath, file));
          }
        }
      } else {
        filesToProcess.push(absPath);
      }
    } else {
      console.error(`❌ 找不到指定檔案或目錄: ${fileArg}`);
      process.exit(1);
    }
  }
} else {
  // 沒有指定 --file，預設邏輯：自動搜尋專案根目錄下所有非暫存的 *.xls 或 *.xlsx
  const rootDir = path.join(__dirname, '..');
  const files = fs.readdirSync(rootDir);
  const foundFiles = files
    .filter(file => (file.endsWith('.xls') || file.endsWith('.xlsx')) && !file.startsWith('~$'))
    .map(file => path.join(rootDir, file));
  
  if (foundFiles.length > 0) {
    filesToProcess = foundFiles;
    console.log(`🔍 未指定檔案，自動搜尋到根目錄下 ${filesToProcess.length} 個 Excel 檔案。`);
  }
}

if (filesToProcess.length === 0) {
  console.error(`❌ 找不到可處理的 Excel 檔案！`);
  console.error('   請放置 list_to_upload.xls 到專案根目錄');
  console.error('   或在根目錄放置多個 .xls / .xlsx 檔案');
  console.error('   或使用 --file="檔案路徑1,檔案路徑2" 或 --file="資料夾路徑" 指定');
  process.exit(1);
}

console.log(`📋 預計處理以下 ${filesToProcess.length} 個檔案:`);
filesToProcess.forEach((f, idx) => console.log(`   [${idx + 1}] ${path.basename(f)}`));

// 單別 → type 對應
const TYPE_MAP = {
  '銷貨': 'sales',
  '銷退': 'salesReturn',
  '進貨': 'purchase',
  '進退': 'purchaseReturn',
};

// 採購類（對象 → supplier_name）
const IS_PROCUREMENT = new Set(['purchase', 'purchaseReturn']);

// ── SQL 工具函式 ─────────────────────────────────────────
function sqlStr(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function sqlNum(n) {
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}


// ── 解析資料 ─────────────────────────────────────────────
const documents = new Map();   // doc_id → { header info }
const items     = [];           // { doc_id, p_id, name, car_model, qty, unit_price, note }

for (const file of filesToProcess) {
  console.log(`\n📂 讀取 XLS 檔案: ${file}`);
  let rows;
  try {
    const wb = xlsx.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log(`   共 ${rows.length} 行（含表頭/合計）`);
  } catch (err) {
    console.error(`❌ 讀取檔案失敗: ${file}`, err.message);
    continue;
  }

  let currentDoc = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === null)) continue;

    const col0  = row[0]  != null ? String(row[0]).trim()  : '';
    const col3  = row[3]  != null ? String(row[3]).trim()  : '';
    const col5  = row[5]  != null ? String(row[5]).trim()  : '';
    const col9  = row[9]  != null ? String(row[9]).trim()  : '';
    const col10 = row[10] != null ? String(row[10]).trim() : '';
    const col13 = row[13] != null ? String(row[13]).trim() : '';
    const col15 = row[15] != null ? String(row[15]).trim() : '';
    const col18 = row[18];   // 數量
    const col20 = row[20];   // 實價
    const col22 = row[22] != null ? String(row[22]).trim() : '';

    // 跳過表頭重複列（單號=「單號」）
    if (col0 === '單號') continue;

    // 跳過合計列
    if (col0.includes('合計') || col0.includes('淨額')) continue;

    // 是否為新單據的起始行（col0 有單號 且 col9 有單別）
    if (col0 && TYPE_MAP[col9]) {
      const type = TYPE_MAP[col9];
      currentDoc = {
        doc_id:   col0,
        type:     type,
        date:     col5 || '',
        party:    col3,   // 客戶或供應商名稱
        branch:   branchArg,
      };
      documents.set(col0, currentDoc);
    }

    // 有零件號碼才算明細行
    const rawPid = col10.replace(/^'+/, '').trim();  // 去除開頭的 '
    if (!rawPid || !currentDoc) continue;

    const qty        = sqlNum(col18);
    const unit_price = sqlNum(col20);
    const car_model  = col13;
    const name       = col15;
    const note       = col22;

    items.push({
      doc_id:     currentDoc.doc_id,
      p_id:       rawPid,
      name:       name,
      car_model:  car_model,
      qty:        qty,
      unit_price: unit_price,
      note:       note,
    });
  }
}

console.log(`\n✅ 解析完成:`);
console.log(`   單據數: ${documents.size}`);
console.log(`   明細數: ${items.length}`);

// 列出各單別統計
const typeCounts = {};
for (const [, doc] of documents) {
  typeCounts[doc.type] = (typeCounts[doc.type] || 0) + 1;
}
for (const [type, cnt] of Object.entries(typeCounts)) {
  console.log(`   ${type}: ${cnt} 筆`);
}

// ── 產生 SQL ─────────────────────────────────────────────
const sqlLines = [];
sqlLines.push('-- 日報明細表匯入 SQL');
sqlLines.push(`-- 來源: ${filesToProcess.map(f => path.basename(f)).join(', ')}`);
sqlLines.push(`-- 分店: ${branchArg}`);
sqlLines.push(`-- 產生時間: ${new Date().toISOString()}`);
sqlLines.push('-- ==========================================');
sqlLines.push('');
sqlLines.push('PRAGMA defer_foreign_keys = ON;');
sqlLines.push('');

// 先刪除舊有資料（以 doc_id 為鍵，允許重複匯入）
const allDocIds = [...documents.keys()];
if (allDocIds.length > 0) {
  sqlLines.push('-- 清除舊有單據（如已存在）');
  for (const doc_id of allDocIds) {
    sqlLines.push(`DELETE FROM document_items WHERE doc_id = ${sqlStr(doc_id)};`);
    sqlLines.push(`DELETE FROM documents WHERE doc_id = ${sqlStr(doc_id)};`);
  }
  sqlLines.push('');
}

// 插入主檔
sqlLines.push('-- === 插入單據主檔 ===');
for (const [, doc] of documents) {
  const isProcurement = IS_PROCUREMENT.has(doc.type);
  const partyCol = isProcurement ? 'supplier_name' : 'customer_name';
  sqlLines.push(
    `INSERT INTO documents (doc_id, type, date, ${partyCol}, status, branch_id) VALUES (` +
    `${sqlStr(doc.doc_id)}, ${sqlStr(doc.type)}, ${sqlStr(doc.date)}, ` +
    `${sqlStr(doc.party)}, 'completed', ${sqlStr(doc.branch)});`
  );
}

sqlLines.push('');
sqlLines.push('-- === 插入明細 ===');
for (const item of items) {
  const noteVal = [item.car_model, item.note].filter(Boolean).join(' | ') || null;
  sqlLines.push(
    `INSERT INTO document_items (doc_id, p_id, part_number, name, qty, unit_price, note) VALUES (` +
    `${sqlStr(item.doc_id)}, ${sqlStr(item.p_id)}, ${sqlStr(item.p_id)}, ` +
    `${sqlStr(item.name)}, ${item.qty}, ${item.unit_price}, ${sqlStr(noteVal)});`
  );
}

sqlLines.push('');
sqlLines.push(`-- 合計: ${documents.size} 筆單據, ${items.length} 筆明細`);

// ── 輸出 SQL 檔案 ─────────────────────────────────────────
const outDir  = path.join(__dirname, '..', 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let sqlFile;
if (filesToProcess.length === 1) {
  const baseName = path.basename(filesToProcess[0], path.extname(filesToProcess[0]));
  sqlFile  = path.join(outDir, `import_daily_${branchArg}_${baseName}.sql`);
} else {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  sqlFile  = path.join(outDir, `import_daily_${branchArg}_batch_${filesToProcess.length}files_${timestamp}.sql`);
}

const sqlContent = sqlLines.join('\n');
fs.writeFileSync(sqlFile, sqlContent, 'utf8');

console.log(`\n📄 SQL 已產生: ${sqlFile}`);
console.log(`   ${documents.size} 筆單據, ${items.length} 筆明細`);

if (dryRun) {
  console.log('\n🔍 Dry-run 模式，顯示前 30 行 SQL:');
  sqlLines.slice(0, 30).forEach(l => console.log('  ' + l));
  console.log('\n⏭️  （僅預覽，未實際寫入資料庫）');
  process.exit(0);
}

// ── 執行匯入 ─────────────────────────────────────────────
const targetFlag = remote ? '--remote' : '--local';
const dbName     = 'erp-db';
const importCmd  = `npx wrangler d1 execute ${dbName} ${targetFlag} --file="${sqlFile}"`;

console.log(`\n🚀 開始匯入到${remote ? '遠端' : '本地'} D1 資料庫...`);
console.log(`   指令: ${importCmd}`);

try {
  execSync(importCmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n✅ 匯入成功！');
} catch (err) {
  console.error('\n❌ 匯入失敗:', err.message);
  console.log('您可以手動執行以下指令:');
  console.log(`  ${importCmd}`);
  process.exit(1);
}
