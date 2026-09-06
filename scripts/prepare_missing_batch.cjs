const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const KEYWORDS_FILE = path.join(ROOT_DIR, 'keywords.txt');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// 安全解析 JSON（過濾 Cloudflare Wrangler 輸出的 🌀 Warning 等非 JSON 提示）
function safeParseJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    const firstArr = str.indexOf('[');
    const lastArr = str.lastIndexOf(']');
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      return JSON.parse(str.substring(firstArr, lastArr + 1));
    }
    const firstObj = str.indexOf('{');
    const lastObj = str.lastIndexOf('}');
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      return JSON.parse(str.substring(firstObj, lastObj + 1));
    }
    throw e;
  }
}

// 解析 CLI 參數
const args = process.argv.slice(2);
const getArg = (name) => {
  const prefix = `--${name}=`;
  const found = args.find(a => a.startsWith(prefix));
  if (found) return found.slice(prefix.length).trim();
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1].trim();
  }
  return null;
};

const sizeArg = getArg('size');
const limit = parseInt(sizeArg || '30', 10); // 預設每批 30 筆

const dateArg = getArg('date');
const startDateArg = getArg('start-date') || getArg('start');
const endDateArg = getArg('end-date') || getArg('end');
const monthArg = getArg('month');
const targetArg = getArg('target') || 'remote';
const targetFlag = targetArg === 'local' ? '--local' : '--remote';

let dateFilter = '';
let dateMsg = '全單據';

if (monthArg) {
  const cleanMonth = monthArg.trim();
  dateFilter = ` AND d.date LIKE '${cleanMonth}%'`;
  dateMsg = ` (限定月份：${cleanMonth})`;
} else if (startDateArg && endDateArg) {
  dateFilter = ` AND d.date >= '${startDateArg.trim()}' AND d.date <= '${endDateArg.trim()}'`;
  dateMsg = ` (限定日期區間：${startDateArg.trim()} 至 ${endDateArg.trim()})`;
} else if (startDateArg) {
  dateFilter = ` AND d.date >= '${startDateArg.trim()}'`;
  dateMsg = ` (限定起日：${startDateArg.trim()})`;
} else if (endDateArg) {
  dateFilter = ` AND d.date <= '${endDateArg.trim()}'`;
  dateMsg = ` (限定迄日：${endDateArg.trim()})`;
} else if (dateArg) {
  dateFilter = ` AND d.date = '${dateArg.trim()}'`;
  dateMsg = ` (限定特定單一日期：${dateArg.trim()})`;
}

console.log('==================================================');
console.log(`🔍 正在從雲端/本地 D1 資料庫尋找單據中缺失的零件料號${dateMsg}...`);
console.log('==================================================\n');

try {
  // 不限定 type = 'sales'，跨銷貨、報價、進貨、退貨、詢價所有單據 (同時包含尚未抓取與僅有'舊系統無此規格'標記的料號)
  // 注意：要把 p_id 先做 UPPER + TRIM，避免 man052 / MAN052 被視為不同料號而造成無限重複抓取。
  const totalQuery = `
    SELECT COUNT(DISTINCT di.p_id) as count
    FROM document_items di
    JOIN documents d ON di.doc_id = d.doc_id
    WHERE di.p_id IS NOT NULL
      AND TRIM(di.p_id) != ''
      ${dateFilter}
      AND UPPER(TRIM(di.p_id)) NOT IN (
        SELECT DISTINCT UPPER(TRIM(p_id))
        FROM products
        WHERE p_id IS NOT NULL
          AND TRIM(p_id) != ''
          AND name IS NOT NULL
          AND name != ''
          AND (name != '舊系統無此規格' OR (updated_at IS NOT NULL AND updated_at > datetime('now', '-12 hours')))
      );
  `;
  const batchQuery = `
    SELECT DISTINCT di.p_id
    FROM document_items di
    JOIN documents d ON di.doc_id = d.doc_id
    WHERE di.p_id IS NOT NULL
      AND TRIM(di.p_id) != ''
      ${dateFilter}
      AND UPPER(TRIM(di.p_id)) NOT IN (
        SELECT DISTINCT UPPER(TRIM(p_id))
        FROM products
        WHERE p_id IS NOT NULL
          AND TRIM(p_id) != ''
          AND name IS NOT NULL
          AND name != ''
          AND (name != '舊系統無此規格' OR (updated_at IS NOT NULL AND updated_at > datetime('now', '-12 hours')))
      )
    ORDER BY di.p_id
    LIMIT ${limit};
  `;

  const runD1Query = (sql) => {
    const compactSql = sql.replace(/\s+/g, ' ').trim();
    // stderr 保留（pipe），失敗時才能看到 wrangler 的真正錯誤訊息
    return execSync(
      `npx wrangler d1 execute erp-db ${targetFlag} --command=${JSON.stringify(compactSql)} --json`,
      {
        encoding: 'utf8',
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
  };

  // 1. 取得總缺失數量
  const totalResult = runD1Query(totalQuery);
  
  const parsedTotal = safeParseJson(totalResult);
  const totalCount = parsedTotal[0]?.results[0]?.count || 0;

  if (totalCount === 0) {
    console.log(`🎉 恭喜！${dateMsg}中的所有單據零件料號，在產品主檔中皆已有完整資料！`);
    fs.writeFileSync(KEYWORDS_FILE, '', 'utf8');
    process.exit(0);
  }

  console.log(`📊 目前符合條件的單據中，共有 ${totalCount} 筆零件缺少規格與詳細資料。`);
  console.log(`正在取出前 ${Math.min(limit, totalCount)} 筆寫入待爬清單...\n`);

  // 2. 取得這批缺失的料號
  const batchResult = runD1Query(batchQuery);

  const parsedBatch = safeParseJson(batchResult);
  if (parsedBatch && parsedBatch[0] && parsedBatch[0].results) {
    const pIds = parsedBatch[0].results.map(r => String(r.p_id).trim()).filter(Boolean);
    const validPIds = pIds.filter(id => id.replace(/\s+/g, '').length >= 2);

    fs.writeFileSync(KEYWORDS_FILE, validPIds.join('\n') + '\n', 'utf8');

    console.log('✅ 已成功將以下缺失料號寫入 keywords.txt：');
    validPIds.forEach((id, idx) => {
      console.log(`  [${idx + 1}] ${id}`);
    });

    console.log('\n--------------------------------------------------');
    console.log('👉 下一步：將由爬蟲腳本 auto_run / run_all 接手執行抓取。');
    console.log('--------------------------------------------------\n');
  }
} catch (e) {
  console.error('❌ 查詢 D1 資料庫時發生錯誤：', e.message);
  // 印出 wrangler 的實際錯誤輸出，方便診斷（網路斷線、權杖過期、SQL 錯誤等）
  const stderrText = String(e.stderr || '').trim();
  const stdoutText = String(e.stdout || '').trim();
  if (stderrText) {
    console.error('\n── wrangler 錯誤輸出（stderr）──');
    console.error(stderrText.slice(0, 3000));
  }
  if (!stderrText && stdoutText) {
    console.error('\n── wrangler 輸出（stdout）──');
    console.error(stdoutText.slice(0, 3000));
  }
  console.log('\n請確認是否已連線網路及登入 Cloudflare Wrangler (npx wrangler login)。');
  process.exit(1);
}
