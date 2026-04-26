/**
 * generate_import_sql.cjs
 * 從 output/products_main.csv 產生 ERP D1 資料庫的 INSERT SQL
 *
 * 欄位對應（根據實際 CSV 內容分析）:
 *   CSV p_id    → DB p_id       (零件號碼)
 *   CSV brand   → DB name       (品名,  e.g. 壓縮機)
 *   CSV price_a → DB brand      (品牌,  e.g. 外匯/DENSO)
 *   CSV price_b → DB stock      (庫存,  e.g. 0,3)
 *   CSV stock   → DB specifications (規格, e.g. 精工 鋁殼)
 *   CSV name    → DB car_models  (車種,  e.g. BMW E30 3系列)
 *
 * 執行: node scripts/generate_import_sql.cjs
 * 匯入: npx wrangler d1 execute erp-db --remote --file=output/import_products.sql
 */

const fs   = require('fs');
const path = require('path');

const MAIN_CSV    = path.join(__dirname, '..', 'output', 'products_main.csv');
const COMPAT_CSV  = path.join(__dirname, '..', 'output', 'products_compatible.csv');
const SQL_FILE    = path.join(__dirname, '..', 'output', 'import_products.sql');

// ── 解析 CSV（支援含逗號的引號欄位）──────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

// ── SQL 字串轉義 ──────────────────────────────────────
function sqlStr(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function sqlInt(s) {
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── 讀取 CSV ──────────────────────────────────────────
const rawMain   = fs.readFileSync(MAIN_CSV, 'utf8').replace(/^\uFEFF/, '');
const rowsMain  = rawMain.split('\n').filter(l => l.trim());
const headerMain= parseCSVLine(rowsMain[0]);

const rawCompat = fs.existsSync(COMPAT_CSV) ? fs.readFileSync(COMPAT_CSV, 'utf8').replace(/^\uFEFF/, '') : '';
const rowsCompat= rawCompat ? rawCompat.split('\n').filter(l => l.trim()) : [];

console.log('Main Headers:', headerMain.join(' | '));
console.log(`Total Main rows: ${rowsMain.length - 1}`);
console.log(`Total Compat rows: ${rowsCompat.length > 0 ? rowsCompat.length - 1 : 0}`);

// ── 整理適用資料 ──────────────────────────────────────
const compatMap = {}; // { p_id: [compatObject1, compatObject2, ...] }
for (let i = 1; i < rowsCompat.length; i++) {
  const cols = parseCSVLine(rowsCompat[i]);
  const p_id = cols[0] || '';
  if (!p_id) continue;
  
  if (!compatMap[p_id]) compatMap[p_id] = [];
  
  // compat cols 實際產出有偏移:
  // c[2]=適用號碼
  // c[3]=empty, c[4]=車種  (或 fallback 時 c[3]=車種, c[4]='')
  // c[5]=empty, c[6]=年份  (或 fallback 時 c[5]=年份, c[6]='')
  // c[8]=品名, c[9]=品名規格 (或 fallback 時 c[7]=品名規格)
  
  const car_model = cols[4] || cols[3] || '';
  const year = cols[6] || cols[5] || '';
  const name_spec = cols[9] || cols[7] || '';
  
  // Skip truly empty fallback rows that have no car_model and no name_spec, we will regenerate them later if needed
  if (!cols[2] && !car_model && !name_spec) continue;

  compatMap[p_id].push({
    pn_id:       `pn_${p_id}_${compatMap[p_id].length + 1}`,
    part_number: cols[2] || '',
    car_model:   car_model,
    year:        year,
    brand:       '', // 將會從主產品繼承
    name_spec:   name_spec,
    note:        ''
  });
}

// ── 產生 SQL ──────────────────────────────────────────
const sqlLines = [];

sqlLines.push('-- Auto-generated import SQL from products_main.csv and products_compatible.csv');
sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
sqlLines.push(`-- Total: ${rowsMain.length - 1} products`);
sqlLines.push('-- First we delete existing matching records to allow fresh insert');
sqlLines.push('');

let inserted = 0;
const skipped = [];
const allPids = [];

for (let i = 1; i < rowsMain.length; i++) {
  const line = rowsMain[i];
  if (!line.trim()) continue;

  const cols = parseCSVLine(line);

  // === 欄位對應（對齊實際 CSV 內容）===
  const p_id         = cols[0]  || '';  
  const car_model_raw= cols[1]  || '';  // 實際車種
  const prod_name    = cols[2]  || '';  // 實際品名
  const spec_raw     = cols[3]  || '';  // 實際規格
  const year_raw     = cols[4]  || '';  // 實際年份
  const brand_raw    = cols[7]  || '';  // 實際品牌
  const stock_raw    = cols[8]  || '0'; // 實際庫存

  if (!p_id || !/^[A-Z]+-/.test(p_id)) {
    skipped.push(`Row ${i}: invalid p_id "${p_id}"`);
    continue;
  }
  
  allPids.push(p_id);

  // 清理年份
  const year = (year_raw === p_id) ? '' : year_raw;

  // car_models JSON array
  const carModelsArr = [];
  if (car_model_raw) {
    carModelsArr.push({ model: car_model_raw, year: year });
  }
  const carModelsJson = JSON.stringify(carModelsArr);

  // part_numbers JSON array (來自 products_compatible.csv)
  let partNumbersArr = compatMap[p_id] || [];
  
  // 繼承品牌與清理資料，並將第一筆設為主項目
  partNumbersArr = partNumbersArr.map((pn, index) => ({
    ...pn,
    is_main: index === 0,
    brand: pn.brand || brand_raw
  }));

  if (partNumbersArr.length === 0) {
    // 萬一沒有適用資料，加入它自己作為唯一的一筆
    partNumbersArr = [{
      pn_id:       `pn_${p_id}_1`,
      is_main:     true,
      part_number: p_id,
      car_model:   car_model_raw,
      year:        year,
      brand:       brand_raw,
      name_spec:   spec_raw,
      note:        ''
    }];
  }
  const partNumbersJson = JSON.stringify(partNumbersArr);

  const stockNum = sqlInt(stock_raw);
  const category = prod_name;
  const imagesJson = '[]';

  const sql = `INSERT INTO products (p_id, name, car_models, category, images, part_numbers, brand, stock, specifications, safety_stock, base_cost, updated_at) VALUES (${[
    sqlStr(p_id),
    sqlStr(prod_name),
    sqlStr(carModelsJson),
    sqlStr(category),
    sqlStr(imagesJson),
    sqlStr(partNumbersJson),
    sqlStr(brand_raw),
    stockNum,
    sqlStr(spec_raw),
    0,
    0,
    'CURRENT_TIMESTAMP'
  ].join(', ')});`;

  sqlLines.push(sql);
  inserted++;
}

// 在開頭加入 DELETE 語句，清除這批產品
if (allPids.length > 0) {
  const pidsList = allPids.map(id => `'${id}'`).join(', ');
  sqlLines.splice(5, 0, `DELETE FROM products WHERE p_id IN (${pidsList});`);
  sqlLines.splice(6, 0, '');
}

sqlLines.push('');
sqlLines.push(`-- Summary: ${inserted} INSERT statements, ${skipped.length} skipped`);
if (skipped.length > 0) {
  skipped.forEach(s => sqlLines.push(`-- SKIPPED: ${s}`));
}

fs.writeFileSync(SQL_FILE, sqlLines.join('\n'), 'utf8');

console.log(`\n✅ SQL generated: ${SQL_FILE}`);
console.log(`   INSERT count : ${inserted}`);
console.log(`   Skipped      : ${skipped.length}`);
console.log('\nTo import:');
console.log('  npx wrangler d1 execute erp-db --remote --file=output/import_products.sql');

