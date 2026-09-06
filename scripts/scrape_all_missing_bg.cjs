const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const KEYWORDS_FILE = path.join(ROOT_DIR, 'keywords.txt');

const BATCH_SIZE = 30; // 每一批的數量
const SLEEP_BETWEEN_BATCHES = 10000; // 批次之間休息 10 秒
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// 接收 CLI 參數
const rawArgs = process.argv.slice(2);
const dateArg = rawArgs.find(a => a.startsWith('--date='))?.split('=')[1];
const startDateArg = rawArgs.find(a => a.startsWith('--start-date='))?.split('=')[1] || rawArgs.find(a => a.startsWith('--start='))?.split('=')[1];
const endDateArg = rawArgs.find(a => a.startsWith('--end-date='))?.split('=')[1] || rawArgs.find(a => a.startsWith('--end='))?.split('=')[1];
const monthArg = rawArgs.find(a => a.startsWith('--month='))?.split('=')[1];
const targetArg = rawArgs.find(a => a.startsWith('--target='))?.split('=')[1] || 'remote';
const targetFlag = targetArg === 'local' ? '--local' : '--remote';

let dateParam = '';
let dateMsg = '全單據';

if (monthArg) {
  dateParam = ` --month=${monthArg}`;
  dateMsg = ` (限定月份：${monthArg})`;
} else if (startDateArg && endDateArg) {
  dateParam = ` --start-date=${startDateArg} --end-date=${endDateArg}`;
  dateMsg = ` (限定日期區間：${startDateArg} 至 ${endDateArg})`;
} else if (startDateArg) {
  dateParam = ` --start-date=${startDateArg}`;
  dateMsg = ` (限定起日：${startDateArg})`;
} else if (endDateArg) {
  dateParam = ` --end-date=${endDateArg}`;
  dateMsg = ` (限定迄日：${endDateArg})`;
} else if (dateArg) {
  dateParam = ` --date=${dateArg}`;
  dateMsg = ` (限定特定單一日期：${dateArg})`;
}

// 清理單據明細中的警示標記與更新品名
function enrichDocumentItems() {
  console.log('🧹 正在更新單據明細的品名並清除「⚠️ 新系統無此料號」標記...');
  try {
    const updateSql = `
      UPDATE document_items 
      SET note = CASE WHEN note = '⚠️ 新系統無此料號' THEN '' ELSE note END,
          name = COALESCE((
            SELECT name
            FROM products
            WHERE UPPER(TRIM(products.p_id)) = UPPER(TRIM(document_items.p_id))
              AND products.name != '舊系統無此規格'
            LIMIT 1
          ), name)
      WHERE UPPER(TRIM(p_id)) IN (
        SELECT DISTINCT UPPER(TRIM(p_id))
        FROM products
        WHERE name IS NOT NULL AND name != '' AND name != '舊系統無此規格'
      );
    `.trim();

    const enrichSqlFile = path.join(ROOT_DIR, 'output', 'enrich_items.sql');
    fs.writeFileSync(enrichSqlFile, updateSql, 'utf8');

    execSync(`npx wrangler d1 execute erp-db ${targetFlag} --file=output/enrich_items.sql --json`, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('✨ 單據明細狀態更新完成！');
  } catch (e) {
    console.log('⚠️ 清理單據明細警示時發生小警告（不影響爬蟲結果）：', e.message?.slice(0, 150));
    const stderrText = String(e.stderr || '').trim();
    if (stderrText) console.log('   wrangler stderr:', stderrText.slice(0, 500));
  }
}

console.log('==================================================');
console.log(`🤖 缺失零件資料補齊與自動爬蟲背景程序開始執行${dateMsg}`);
console.log('==================================================\n');

(async () => {
  let batchNum = 1;

  while (true) {
    console.log(`\n--- [批次 #${batchNum}] 檢查並準備待補齊料號 ---`);

    // 1. 執行比對，產出 keywords.txt
    let prepareOutput = '';
    try {
      prepareOutput = execSync(`node scripts/prepare_missing_batch.cjs --size=${BATCH_SIZE}${dateParam} --target=${targetArg}`, {
        encoding: 'utf8',
        cwd: ROOT_DIR
      });
      console.log(prepareOutput);

      if (prepareOutput.includes('恭喜！') || prepareOutput.includes('已有完整資料')) {
        // 完成前最後清理單據標記
        enrichDocumentItems();
        console.log('\n==================================================');
        console.log(`🎉 任務全數完成！${dateMsg}中的所有缺失零件資料與照片均已補齊！`);
        console.log('👉 請回到 erp-autoparts-v13.page.dev 網頁重新整理即可看到完整資料。');
        console.log('==================================================\n');
        break;
      }
    } catch (err) {
      console.error('❌ 準備缺失料號清單時發生錯誤：', err.message);
      // 印出子腳本的完整輸出（含 wrangler 錯誤），避免只剩 Command failed 一行
      const childStdout = String(err.stdout || '').trim();
      const childStderr = String(err.stderr || '').trim();
      if (childStdout) {
        console.error('\n── prepare_missing_batch 輸出 ──');
        console.error(childStdout.slice(0, 3000));
      }
      if (childStderr) {
        console.error('\n── prepare_missing_batch 錯誤輸出 ──');
        console.error(childStderr.slice(0, 3000));
      }
      process.exit(1);
    }

    // 檢查 keywords.txt 是否有資料
    if (fs.existsSync(KEYWORDS_FILE)) {
      const keywords = fs.readFileSync(KEYWORDS_FILE, 'utf8').trim();
      if (!keywords) {
        enrichDocumentItems();
        console.log(`\n🎉 ${dateMsg}的所有缺失料號皆已處理完成！`);
        break;
      }
    }

    // 2. 執行爬蟲與匯入 (預設無頭模式 + --force 覆蓋)
    console.log(`\n🚀 開始執行爬蟲與雲端匯入 [批次 #${batchNum}] (無頭模式)...`);
    try {
      execSync('node scripts/run_all.cjs --headless --force', { stdio: 'inherit', cwd: ROOT_DIR });
      console.log(`✅ [批次 #${batchNum}] 爬蟲與雲端匯入成功完成！`);

      // 每批完成後更新明細欄位
      enrichDocumentItems();

    } catch (err) {
      const status = err.status;
      if (status === 2) {
        console.error('\n⚠️ 爬蟲暫停：舊系統 Session Cookie 已過期（登入失效）。');
        console.error('👉 請在終端機手動執行以下指令，透過跳出的瀏覽器視窗完成一次登入：');
        console.log('\n  node scripts/run_all.cjs\n');
        console.log('完成登入後，再重新執行本補齊指令即可繼續未完的進度。\n');
        process.exit(2);
      } else {
        console.error(`\n❌ [批次 #${batchNum}] 執行發生異常，錯誤碼: ${status}，原因: ${err.message}`);
        console.log('系統將在 30 秒後嘗試重試此批次...');
        await sleep(30000);
        continue;
      }
    }

    batchNum++;
    console.log(`\n😴 批次完成，休息 ${SLEEP_BETWEEN_BATCHES / 1000} 秒後繼續下一批...`);
    await sleep(SLEEP_BETWEEN_BATCHES);
  }
})();
