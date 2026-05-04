const { execSync, exec } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function checkProcess() {
  return new Promise(resolve => {
    exec('wmic process where "name=\'node.exe\' and commandline like \'%scrape_parts.cjs%\'" get processid', (err, stdout) => {
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
  console.log('🤖 AI 自動化任務已啟動！');
  console.log('==========================================');
  console.log('⏳ 正在監控並等待您目前的 scrape_parts.cjs 執行完畢...');

  while(await checkProcess()) {
    await sleep(30000); // 每 30 秒檢查一次
  }
  
  console.log('\n✅ 偵測到 scrape_parts.cjs 執行結束！');
  console.log('🚀 正在自動接手：執行第一步 (抓取舊照片網址)...');
  console.log('------------------------------------------');
  try {
    execSync('node scripts/scrape_legacy_photos.cjs', { stdio: 'inherit' });
  } catch(e) {
    console.error('執行 scrape_legacy_photos.cjs 發生錯誤:', e.message);
  }

  console.log('\n✅ 第一步完成！');
  console.log('🚀 正在自動接手：執行第二步 (將照片搬家到 R2)...');
  console.log('------------------------------------------');
  try {
    execSync('node scripts/migrate_photos_to_r2.cjs', { stdio: 'inherit' });
  } catch(e) {
    console.error('執行 migrate_photos_to_r2.cjs 發生錯誤:', e.message);
  }
  
  console.log('\n🎉 所有任務已由 AI 代為執行完成！您可以安心檢查結果。');
})();
