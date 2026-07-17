const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 30; // 每一批的數量
const SLEEP_BETWEEN_BATCHES = 10000; // 批次之間休息 10 秒，避免被鎖 IP
const sleep = ms => new Promise(r => setTimeout(r, ms));

const dateArg = process.argv.find(a => a.startsWith('--date='))?.split('=')[1];
const startDateArg = process.argv.find(a => a.startsWith('--start-date='))?.split('=')[1];
const endDateArg = process.argv.find(a => a.startsWith('--end-date='))?.split('=')[1];

let dateParam = '';
let dateMsg = '';

if (startDateArg && endDateArg) {
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
  dateMsg = ` (限定日期：${dateArg})`;
}

console.log('==================================================');
console.log(`🤖 AI 全自動「缺失單據零件」背景爬蟲任務開始執行${dateMsg}`);
console.log('==================================================\n');

(async () => {
  let batchNum = 1;
  
  while (true) {
    console.log(`\n--- [批次 #${batchNum}] 開始比對並準備資料 ---`);
    
    // 1. 執行比對，準備接下來的料號
    let prepareOutput = '';
    try {
      prepareOutput = execSync(`node scripts/prepare_missing_batch.cjs --size=${BATCH_SIZE}${dateParam}`, { encoding: 'utf8' });
      console.log(prepareOutput);
      
      // 如果準備程式提示「恭喜！目前雲端單據中的所有零件料號，在產品資料庫中皆已有資料！」
      if (prepareOutput.includes('恭喜！') || prepareOutput.includes('已經有資料')) {
        console.log('🎉 任務完成！所有單據中的零件資料均已補齊！');
        break;
      }
    } catch (err) {
      console.error('❌ 準備缺失料號時發生錯誤：', err.message);
      process.exit(1);
    }
    
    // 2. 執行無頭爬蟲與匯入
    console.log(`\n🚀 開始執行爬蟲與匯入 [批次 #${batchNum}] (無頭模式)...`);
    try {
      execSync('node scripts/run_all.cjs --headless', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log(`✅ [批次 #${batchNum}] 成功完成抓取與雲端匯入！`);
    } catch (err) {
      // 檢查是否為登入失效的錯誤 (Exit Code 2)
      const status = err.status;
      if (status === 2) {
        console.error('\n⚠️  背景爬蟲暫停：您的登入狀態已失效 (Session Cookie expired)。');
        console.error('👉 請您在本機手動執行一次以下指令，並在瀏覽器中完成登入：');
        console.log('\n  node scripts/run_all.cjs');
        console.log('\n登入完成並跑完該批次後，我會繼續自動接手剩下的部分。\n');
        process.exit(2);
      } else {
        console.error(`\n❌ [批次 #${batchNum}] 執行失敗，錯誤碼: ${status}，原因: ${err.message}`);
        console.log('系統將在 30 秒後嘗試重新執行此批次...');
        await sleep(30000);
        continue; // 重新嘗試同一個批次
      }
    }
    
    batchNum++;
    console.log(`\n😴 批次完成，休息 ${SLEEP_BETWEEN_BATCHES / 1000} 秒後繼續下一批，保護對方伺服器...`);
    await sleep(SLEEP_BETWEEN_BATCHES);
  }
})();
