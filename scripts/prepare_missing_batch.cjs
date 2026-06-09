const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEYWORDS_FILE = path.join(__dirname, '..', 'keywords.txt');

// 解析參數
const sizeArg = process.argv.find(a => a.startsWith('--size='))?.split('=')[1];
const limit = parseInt(sizeArg || '30'); // 預設每批 30 筆，避免對方伺服器負荷過大

console.log('==================================================');
console.log('🔍 正在從雲端 D1 資料庫尋找單據中缺失的零件料號...');
console.log('==================================================\n');

try {
  // 查詢雲端 D1 中，存在於「銷貨單」明細但不存在於產品資料庫的零件號碼
  const query = `SELECT DISTINCT p_id FROM document_items WHERE doc_id IN (SELECT doc_id FROM documents WHERE type = 'sales') AND p_id NOT IN (SELECT p_id FROM products) ORDER BY p_id LIMIT ${limit};`;
  const totalQuery = `SELECT COUNT(DISTINCT p_id) as count FROM document_items WHERE doc_id IN (SELECT doc_id FROM documents WHERE type = 'sales') AND p_id NOT IN (SELECT p_id FROM products);`;
  
  // 取得總缺失數量
  const totalResult = execSync(`npx wrangler d1 execute erp-db --remote --command="${totalQuery}" --json`, { encoding: 'utf8' });
  const totalCount = JSON.parse(totalResult)[0]?.results[0]?.count || 0;
  
  if (totalCount === 0) {
    console.log('🎉 恭喜！目前雲端單據中的所有零件料號，在產品資料庫中皆已有資料！');
    process.exit(0);
  }
  
  console.log(`📊 目前雲端共有 ${totalCount} 筆單據零件缺少規格資料。`);
  console.log(`正在取出前 ${limit} 筆準備抓取...\n`);
  
  // 取得這批缺失的料號
  const result = execSync(`npx wrangler d1 execute erp-db --remote --command="${query}" --json`, { encoding: 'utf8' });
  const parsed = JSON.parse(result);
  
  if (parsed && parsed[0] && parsed[0].results) {
    const pIds = parsed[0].results.map(r => r.p_id);
    
    // 過濾掉太短的料號（長度小於 3），避免在舊系統搜尋時匹配出海量無關資料
    const validPIds = pIds.filter(id => id.trim().replace(/\s+/g, '').length >= 3);
    
    // 寫入 keywords.txt (保留原始空格以供資料庫正確比對，搜尋時爬蟲會自動清除空格)
    fs.writeFileSync(KEYWORDS_FILE, validPIds.join('\n') + '\n', 'utf8');
    
    console.log('✅ 已成功將以下料號寫入 keywords.txt：');
    validPIds.forEach((id, idx) => {
      console.log(`  [${idx + 1}] ${id}`);
    });
    
    console.log('\n--------------------------------------------------');
    console.log('👉 下一步操作指引：');
    console.log('請在終端機輸入以下指令啟動爬蟲，抓取這批零件的資料並自動匯入雲端：');
    console.log('\n  node scripts/run_all.cjs');
    console.log('--------------------------------------------------\n');
  }
} catch (e) {
  console.error('❌ 查詢雲端資料庫時發生錯誤：', e.message);
  console.log('請確認您是否已登入 Wrangler (npx wrangler login) 以及網路連線正常。');
  process.exit(1);
}
