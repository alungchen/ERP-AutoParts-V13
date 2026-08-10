/**
 * generate_shorthand_sql.cjs — 將爬回的片語 CSV 轉成 D1 匯入 SQL
 *
 * 讀取: output/shorthand_model.csv / shorthand_part.csv / shorthand_brand.csv
 * 輸出: output/import_shorthands.sql
 *
 * 欄位對應（舊系統 → shorthands 表）:
 *   代碼   → shorthand
 *   名稱   → name
 *   顯示名 → fullname（空白時以「名稱」代替）
 *   備註   → note
 *   車廠   → meta_category（車型）
 *   分類   → meta_category（品名，若舊系統有此欄）
 *
 * 匯入策略: 先清空該 type 的舊資料，再全量插入（與 UI「匯入表格」行為一致）
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUT_SQL = path.join(OUTPUT_DIR, 'import_shorthands.sql');

const TYPES = [
  { type: 'model', csv: 'shorthand_model.csv' },
  { type: 'part',  csv: 'shorthand_part.csv' },
  { type: 'brand', csv: 'shorthand_brand.csv' },
];

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
}

const esc = v => String(v ?? '').replace(/'/g, "''").trim();

let statements = [];
let summary = [];

for (const { type, csv } of TYPES) {
  const file = path.join(OUTPUT_DIR, csv);
  if (!fs.existsSync(file)) {
    console.log(`⚠️ 找不到 ${csv}，略過 ${type}`);
    continue;
  }
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  const headers = rows[0].map(h => h.trim());
  const idx = name => headers.indexOf(name);

  const iCode = idx('代碼');
  const iName = idx('名稱');
  const iLabel = idx('顯示名');
  const iNote = idx('備註');
  const iBrand = idx('車廠');
  const iCategory = idx('分類') >= 0 ? idx('分類') : idx('類別');

  if (iCode < 0) {
    console.log(`❌ ${csv} 缺少「代碼」欄，略過。表頭: ${headers.join(', ')}`);
    continue;
  }

  const seen = new Set();
  const inserts = [];
  let skipped = 0;

  for (const r of rows.slice(1)) {
    const code = (r[iCode] || '').trim();
    const name = iName >= 0 ? (r[iName] || '').trim() : '';
    const label = iLabel >= 0 ? (r[iLabel] || '').trim() : '';
    const note = iNote >= 0 ? (r[iNote] || '').trim() : '';
    const meta = type === 'model'
      ? (iBrand >= 0 ? (r[iBrand] || '').trim() : '')
      : (iCategory >= 0 ? (r[iCategory] || '').trim() : '');

    const fullname = label || name;
    if (!code || !fullname) { skipped++; continue; }

    let sid = `legacy_${type}_${code}`;
    let n = 2;
    while (seen.has(sid)) { sid = `legacy_${type}_${code}_${n++}`; }
    seen.add(sid);

    inserts.push(
      `INSERT OR REPLACE INTO shorthands (s_id, type, shorthand, fullname, meta_category, name, note) ` +
      `VALUES ('${esc(sid)}', '${type}', '${esc(code)}', '${esc(fullname)}', '${esc(meta)}', '${esc(name)}', '${esc(note)}');`
    );
  }

  statements.push(`DELETE FROM shorthands WHERE type = '${type}';`);
  statements.push(...inserts);
  summary.push({ type, count: inserts.length, skipped });
}

fs.writeFileSync(OUT_SQL, statements.join('\n') + '\n', 'utf8');
console.log(`\n💾 已產生 ${OUT_SQL}`);
for (const s of summary) {
  console.log(`  ${s.type}: ${s.count} 筆（略過空白 ${s.skipped} 筆）`);
}
console.log('\n下一步（匯入遠端 D1）:');
console.log('  npx wrangler d1 execute erp-db --remote --file=output/import_shorthands.sql --yes');
