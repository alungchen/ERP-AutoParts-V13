const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_NAME = 'erp-db'; 

try {
  const query = `SELECT p_id, images FROM products WHERE images LIKE '%"url"%';`;
  console.log("尋找格式錯誤的照片...");
  const resultJson = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${query}" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });
  
  const d1Result = JSON.parse(resultJson);
  const products = d1Result[0]?.results || [];
  
  if (products.length === 0) {
      console.log('沒有找到需要修復的資料。');
      process.exit(0);
  }

  console.log(`找到 ${products.length} 筆需要修復的資料...`);
  const sqlStatements = [];

  for (const p of products) {
      try {
          const arr = JSON.parse(p.images);
          // 如果是物件陣列，提取 url 變成字串陣列
          if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
              const strArr = arr.map(obj => obj.url).filter(Boolean);
              const newJson = JSON.stringify(strArr).replace(/'/g, "''");
              sqlStatements.push(`UPDATE products SET images = '${newJson}' WHERE p_id = '${p.p_id}';`);
          }
      } catch (e) {
          // ignore parsing error
      }
  }

  if (sqlStatements.length > 0) {
      const sqlPath = path.join(__dirname, '..', 'output', 'fix_images.sql');
      fs.writeFileSync(sqlPath, sqlStatements.join('\n'), 'utf8');
      console.log(`正在執行修復 SQL...`);
      execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/fix_images.sql`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
      console.log('修復完成！');
  }

} catch (e) {
  console.log('❌ 執行失敗:', e.message);
}
