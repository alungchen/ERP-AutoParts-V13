const { execSync, exec } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function checkProcess() {
  return new Promise(resolve => {
    exec('wmic process where "name=\'node.exe\' and commandline like \'%run_all.cjs%\'" get processid', (err, stdout) => {
      if (err || stdout.includes('No Instance(s) Available') || stdout.trim().split('\n').length <= 1) {
         resolve(false);
      } else {
         resolve(true);
      }
    });
  });
}

(async () => {
  console.log('==========================================');
  console.log('🤖 AI 自動排隊任務已啟動！');
  console.log('==========================================');
  console.log('⏳ 正在監控並等待第一支程式 (run_all.cjs) 執行完畢...');

  while(await checkProcess()) {
    await sleep(30000); // 每 30 秒檢查一次
  }
  
  console.log('\n✅ 偵測到第一支程式 (run_all.cjs) 已結束！');
  console.log('🚀 自動無縫接軌：開始執行第二支程式 (scrape_shorthands.cjs)...');
  console.log('------------------------------------------');
  try {
    execSync('node scripts/scrape_shorthands.cjs', { stdio: 'inherit' });
  } catch(e) {
    console.error('執行 scrape_shorthands.cjs 發生錯誤:', e.message);
  }
  
  console.log('\n🎉 所有排隊任務已由 AI 代為執行完成！');
})();
