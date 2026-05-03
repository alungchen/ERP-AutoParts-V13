const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_NAME = 'erp-db'; // 你的 D1 資料庫名稱
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const keywordsPath = path.join(__dirname, '..', 'keywords.txt');
  let keywords = [];
  if (fs.existsSync(keywordsPath)) {
      keywords = fs.readFileSync(keywordsPath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  }

  console.log('🔄 步驟 1: 從資料庫取得目標產品...');
  let products = [];
  try {
    let query = '';
    if (keywords.length > 0) {
        // 分批模式: 只抓 keywords.txt 裡的產品 (支援部分關鍵字比對)，且限定是還沒有照片的
        const likeClauses = keywords.map(k => `UPPER(p_id) LIKE '%${k.toUpperCase().replace(/'/g, "''")}%'`).join(' OR ');
        query = `SELECT p_id, name FROM products WHERE (${likeClauses}) AND (images IS NULL OR images = '[]' OR images = '');`;
        console.log(`執行查詢 (依照 keywords.txt 指定的 ${keywords.length} 個關鍵字進行模糊搜尋)...`);
    } else {
        // 自動模式: 找出 images 是 NULL, 空陣列, 或空字串的產品
        query = `SELECT p_id, name FROM products WHERE images IS NULL OR images = '[]' OR images = '';`;
        console.log("執行查詢 (找出所有缺照片的產品)...");
    }
    const resultJson = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command="${query}" --json`, { cwd: path.join(__dirname, '..'), encoding: 'utf-8' });
    
    const d1Result = JSON.parse(resultJson);
    products = d1Result[0]?.results || [];
    console.log(`✅ 找到 ${products.length} 筆可能需要照片的產品。`);
  } catch (e) {
    console.log('❌ 取得資料庫資料失敗:', e.message);
    console.log('🔄 嘗試從剛才抓取的 output/products_main.csv 讀取資料作為備用...');
    const csvPath = path.join(OUTPUT_DIR, 'products_main.csv');
    if (fs.existsSync(csvPath)) {
        const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).slice(1);
        for (const line of lines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const p_id = parts[0].replace(/^"|"$/g, '').trim();
                const name = parts[1].replace(/^"|"$/g, '').trim();
                if (!p_id || p_id === 'p_id' || p_id.includes('號碼')) continue;
                
                if (keywords.length > 0) {
                    const match = keywords.some(k => p_id.toUpperCase().includes(k.toUpperCase()));
                    if (!match) continue;
                }
                products.push({ p_id, name });
            }
        }
        console.log(`✅ 備用方案成功：從 CSV 載入了 ${products.length} 筆產品。`);
    } else {
        console.log('❌ 找不到備用 CSV 檔案，無法繼續。');
        return;
    }
  }

  if (products.length === 0) {
      console.log('🎉 所有產品都有照片了！');
      return;
  }

  console.log('\n🚀 步驟 2: 啟動爬蟲，從舊版系統讀取圖片...');
  const browser = await puppeteer.launch({
    headless: "new",
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // 載入登入狀態
  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
  }

  const sqlStatements = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`\n[${i + 1}/${products.length}] 正在抓取: ${p.name || p.p_id} (料號: ${p.p_id}) ...`);

    try {
      // 1. 到搜尋頁面搜尋這個料號
      await page.goto('http://cck2.uparts.info/car2009/parts_query/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(1000);
      
      await page.evaluate((partNo) => {
        const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(el => (el.id || '').startsWith('ele_search_'));
        if (inp) { inp.focus(); inp.value = partNo; inp.dispatchEvent(new Event('change', {bubbles:true})); }
      }, p.p_id);
      
      await sleep(500);
      await page.evaluate(() => document.querySelector('#btn_search')?.click());
      await sleep(4000); // 等待搜尋結果載入

      // 2. 尋找對應的 GUID (partsid)
      const legacyGuid = await page.evaluate(() => {
        // 先找任何帶有 partsid 且 class 包含 media_count 的按鈕
        const btn = document.querySelector('.media_count[partsid]');
        return btn ? btn.getAttribute('partsid') : null;
      });

      if (!legacyGuid) {
          console.log(`  ⚠ 找不到對應的舊系統資料或圖片按鈕`);
          continue;
      }

      console.log(`  - 取得舊系統 GUID: ${legacyGuid}`);

      // 3. 使用 Iframe_MEDIA_List 抓取圖片
      const url = `http://cck2.uparts.info/car2009/Iframe_MEDIA_List/?KeyValue=${legacyGuid}&TableName=%E9%9B%B6%E4%BB%B6%E4%B8%BB%E6%AA%94&message=&TYPE_LABLE=&CHNAME_LABLE=`;
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(1000); // 確保圖片 DOM 載入

      const allImgUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => img.src);
      });
      console.log(`  🔍 Debug: 頁面上有 ${allImgUrls.length} 張圖，來源：`, allImgUrls);

      const imageUrls = allImgUrls.filter(src => 
        src.includes('media2.uparts.info') || src.includes('Upload') || src.toLowerCase().endsWith('.jpg')
      );

      // 移除重複 URL (縮圖和大圖可能是同一個 URL)
      const uniqueUrls = [...new Set(imageUrls)];

      if (uniqueUrls.length > 0) {
        console.log(`  ✓ 找到 ${uniqueUrls.length} 張圖片`);
        
        // 轉為 DB JSON 陣列格式 (只存 URL 字串)
        const imagesJson = JSON.stringify(uniqueUrls).replace(/'/g, "''"); // 處理 SQL 引號
        
        const sqlStmt = `UPDATE products SET images = '${imagesJson}' WHERE p_id = '${p.p_id}';`;
        sqlStatements.push(sqlStmt);
        
        // 即時寫入檔案，避免中斷遺失進度
        const sqlPath = path.join(OUTPUT_DIR, 'update_legacy_photos.sql');
        fs.appendFileSync(sqlPath, sqlStmt + '\n', 'utf8');
      } else {
        console.log(`  ⚠ 找不到圖片`);
      }
    } catch (err) {
      console.log(`  ❌ 抓取失敗: ${err.message}`);
    }

    await sleep(500); // 隨機延遲，不要給舊站太大壓力
  }

  await browser.close();

  console.log('\n💾 步驟 3: 執行 SQL 更新檔 (已即時寫入 output/update_legacy_photos.sql)...');
  if (sqlStatements.length > 0) {
    const sqlPath = path.join(OUTPUT_DIR, 'update_legacy_photos.sql');
    // 注意: 我們在迴圈中已經使用 appendFileSync 即時寫入了，這裡不需要再次覆寫，但可以確保檔案存在
    console.log(`✅ 已確認 SQL 檔案: ${sqlPath}`);
    
    try {
        console.log('🔄 正在將圖片連結更新至遠端 D1 資料庫...');
        execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/update_legacy_photos.sql`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        console.log('🎉 照片更新完成！');
    } catch (e) {
        console.log('❌ 更新至遠端資料庫失敗，請手動執行:');
        console.log(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/update_legacy_photos.sql`);
    }

  } else {
    console.log('⚠️ 沒有找到任何新照片可以更新。');
  }

})();
