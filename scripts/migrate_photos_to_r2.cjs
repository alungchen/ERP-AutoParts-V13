const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_NAME = 'erp-db';
const R2_BUCKET = 'erp-images';
const TEMP_DIR = path.join(__dirname, '..', 'output', 'legacy_photos_backup');

// 自動啟動防休眠程式 (在新視窗開啟)，防止重複開啟
if (!process.env.KEEP_AWAKE_STARTED) {
  console.log('🛡️ 正在自動啟動防休眠程式...');
  const keepAwakePath = path.join(__dirname, 'keep_awake_api.ps1');
  try {
    spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', keepAwakePath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    process.env.KEEP_AWAKE_STARTED = '1';
  } catch (e) {
    console.log('⚠️ 防休眠程式啟動失敗，請確保您有執行 PowerShell 腳本的權限。');
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const keywordsPath = path.join(__dirname, '..', 'keywords.txt');
  let keywords = [];
  if (fs.existsSync(keywordsPath)) {
      keywords = fs.readFileSync(keywordsPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  }

  console.log('🔄 步驟 1: 從資料庫找出所有還在使用舊伺服器照片的產品...');
  let products = [];
  try {
    let query = '';
    if (keywords.length > 0) {
        // 分批模式: 只抓 keywords.txt 裡的產品且仍在使用舊網址的照片
        const likeClauses = keywords.map(k => `UPPER(p_id) LIKE '%${k.toUpperCase().replace(/'/g, "''")}%'`).join(' OR ');
        query = `SELECT p_id, images FROM products WHERE images LIKE '%http://media2.uparts.info%' AND (${likeClauses});`;
        console.log(`執行查詢 (依照 keywords.txt 指定的 ${keywords.length} 個關鍵字進行分批搬移)...`);
    } else {
        // 自動模式: 找出所有包含舊網址的產品
        query = `SELECT p_id, images FROM products WHERE images LIKE '%http://media2.uparts.info%';`;
        console.log("執行查詢 (找出所有依賴舊伺服器的照片)...");
    }
    
    const resultJson = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${query}" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });
    products = JSON.parse(resultJson)[0]?.results || [];
    
    if (products.length === 0) {
        console.log('🎉 恭喜！資料庫中已經沒有依賴舊伺服器的照片了。');
        process.exit(0);
    }
    console.log(`找到 ${products.length} 筆產品需要搬移照片。`);
  } catch (e) {
    console.error('❌ 查詢資料庫失敗:', e.message);
    process.exit(1);
  }

  const sqlStatements = [];
  let totalPhotosMigrated = 0;

  console.log('\n🚀 步驟 2: 開始下載並搬移照片到 Cloudflare R2...');
  
  for (let i = 0; i < products.length; i++) {
      const p = products[i];
      let imagesArr = [];
      try {
          imagesArr = JSON.parse(p.images);
      } catch (e) { continue; }

      const newImagesArr = [];
      let updated = false;

      console.log(`\n[${i+1}/${products.length}] 正在處理料號: ${p.p_id}`);

      for (let j = 0; j < imagesArr.length; j++) {
          const imgUrl = imagesArr[j];
          if (!imgUrl.includes('http://media2.uparts.info')) {
              newImagesArr.push(imgUrl); // 不是舊網址就保留原樣
              continue;
          }

          try {
              // 1. 下載照片到本地
              console.log(`  - ⬇️ 下載照片: ${imgUrl}`);
              const response = await fetch(imgUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const buffer = await response.arrayBuffer();
              const ext = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
              // 產生新檔名 (料號_隨機碼.附檔名)
              const safePid = p.p_id.replace(/[^a-zA-Z0-9_-]/g, '_');
              const randomHex = crypto.randomBytes(4).toString('hex');
              const newFileName = `${safePid}_${randomHex}.${ext}`;
              
              const localFilePath = path.join(TEMP_DIR, newFileName);
              fs.writeFileSync(localFilePath, Buffer.from(buffer));

              // 2. 上傳照片到 Cloudflare R2
              console.log(`  - ☁️ 上傳到 R2: ${newFileName}`);
              execSync(`npx wrangler r2 object put ${R2_BUCKET}/${newFileName} --file="${localFilePath}" --remote`, { stdio: 'pipe' });

              // 3. 準備新的 URL
              const newAppUrl = `/api/images?path=${newFileName}`;
              newImagesArr.push(newAppUrl);
              updated = true;
              totalPhotosMigrated++;
              
              await sleep(500); // 避免請求過快被阻擋
          } catch (e) {
              console.log(`  ❌ 處理失敗 ${imgUrl}: ${e.message}`);
              newImagesArr.push(imgUrl); // 失敗的話保留舊網址
          }
      }

      if (updated) {
          const newImagesJson = JSON.stringify(newImagesArr).replace(/'/g, "''");
          sqlStatements.push(`UPDATE products SET images = '${newImagesJson}' WHERE p_id = '${p.p_id}';`);
      }
  }

  console.log('\n🚀 步驟 3: 更新資料庫中的照片網址...');
  if (sqlStatements.length > 0) {
      const sqlPath = path.join(__dirname, '..', 'output', 'migrate_r2.sql');
      fs.writeFileSync(sqlPath, sqlStatements.join('\n'), 'utf8');
      try {
          execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/migrate_r2.sql --yes`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
          console.log(`\n✅ 搬移大功告成！成功將 ${totalPhotosMigrated} 張舊照片搬到您的 Cloudflare R2 空間！`);
          console.log(`💾 另外，所有的實體照片都已經備份在您的電腦資料夾中: output/legacy_photos_backup/`);
      } catch (e) {
          console.error('\n❌ 更新資料庫失敗，請手動執行:', sqlPath);
          console.error('   💡 提示：如果是 Authentication error [code: 10000]，請嘗試執行：npx wrangler logout 接著 npx wrangler login');
          process.exit(1);
      }
  } else {
      console.log('沒有需要更新的資料。');
  }

})();
