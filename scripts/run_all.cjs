const { execSync } = require('child_process');

console.log('==================================================');
console.log('🤖 AI 全自動化任務啟動：(1) 文字抓取 ➔ (2) 照片網址 ➔ (3) 雲端搬家');
console.log('==================================================\n');

try {
  console.log('▶️ [階段 1/3] 開始執行：抓取文字規格與適用車種 (scrape_parts.cjs)');
  console.log('--------------------------------------------------');
  const args = process.argv.slice(2).join(' ');
  execSync(`node scripts/scrape_parts.cjs ${args}`, { stdio: 'inherit' });
  console.log('✅ 階段 1 完成！\n');

  console.log('▶️ [階段 2/3] 開始執行：回舊系統尋找這些新料號的照片 (scrape_legacy_photos.cjs)');
  console.log('--------------------------------------------------');
  execSync('node scripts/scrape_legacy_photos.cjs', { stdio: 'inherit' });
  console.log('✅ 階段 2 完成！\n');

  console.log('▶️ [階段 3/3] 開始執行：下載實體照片並上傳至 R2 雲端 (migrate_photos_to_r2.cjs)');
  console.log('--------------------------------------------------');
  execSync('node scripts/migrate_photos_to_r2.cjs', { stdio: 'inherit' });
  console.log('✅ 階段 3 完成！\n');

  console.log('==================================================');
  console.log('🎉 恭喜！所有流程（文字 + 照片）已順利無縫接軌執行完畢！');
  console.log('👉 您現在可以打開 ERP 網頁，驗收擁有全新照片的產品資料了。');
  console.log('==================================================\n');
} catch (error) {
  console.error('\n❌ 執行過程中發生中斷或錯誤，自動化流程已暫停。');
  console.error('請檢查上方紅字錯誤訊息後再試一次。');
}
