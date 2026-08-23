const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const DB_NAME = 'erp-db'; // 你的 D1 資料庫名稱
const PRIMARY_COOKIES_FILE = path.join(__dirname, 'cookies_cck.json');
const FALLBACK_COOKIES_FILE = path.join(__dirname, 'cookies.json');
// 使用獨立 profile，避免與 login:uparts 佔用同一個 userDataDir
const PROFILE_DIR = path.join(__dirname, '.chrome-profile-legacy-photos');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const HOST = process.env.UPARTS_HOST || 'cck2.uparts.info';
const PARTS_QUERY_URL = `http://${HOST}/car2009/parts_query/`;
const MEDIA_IFRAME_BASE = `http://${HOST}/car2009/Iframe_MEDIA_List/`;

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

async function openWithRetry(page, url, options = {}) {
  try {
    await page.goto(url, options);
    return;
  } catch (err) {
    if (!String(err.message || '').includes('ERR_BLOCKED_BY_CLIENT')) throw err;
    // 某些環境會由瀏覽器擴充/代理阻擋 http 請求，嘗試升級為 https
    const httpsUrl = url.replace(/^http:\/\//i, 'https://');
    console.log(`  ⚠️ 偵測到 ERR_BLOCKED_BY_CLIENT，改試 HTTPS: ${httpsUrl}`);
    await page.goto(httpsUrl, options);
  }
}

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

function cleanChromeProfileLock(profileDir) {
  try {
    if (process.platform === 'win32') {
      const cleanPathForPs = profileDir.replace(/\\/g, '\\\\');
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${cleanPathForPs}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`;
      try {
        execSync(psCmd, { stdio: 'ignore' });
      } catch (e) {}
      
      const lockFiles = [
        path.join(profileDir, 'SingletonLock'),
        path.join(profileDir, 'SingletonCookie'),
        path.join(profileDir, 'SingletonSocket')
      ];
      lockFiles.forEach(f => {
        if (fs.existsSync(f)) {
          try { fs.unlinkSync(f); } catch (e) {}
        }
      });
    }
  } catch (err) {}
}

  console.log('\n🚀 步驟 2: 啟動爬蟲，從舊版系統讀取圖片...');
  cleanChromeProfileLock(PROFILE_DIR);
  const browser = await puppeteer.launch({
    headless: "new",
    userDataDir: PROFILE_DIR,
    protocolTimeout: 1200000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--no-proxy-server',
      '--proxy-server=direct://',
      '--proxy-bypass-list=*',
      '--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades',
    ]
  });
  const page = await browser.newPage();
  
  const needLogin = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
    !document.querySelector('#btn_search')
  ).catch(() => true);

  const cookieCandidates = [
    path.join(__dirname, 'cookies.json'),
    path.join(__dirname, 'cookies_cck.json'),
    path.join(__dirname, 'cookies_cck2_user.json'),
    path.join(__dirname, 'cookies_xizhi.json'),
    path.join(__dirname, 'cookies_songshan.json')
  ];

  let loggedIn = false;
  for (const cFile of cookieCandidates) {
    if (fs.existsSync(cFile)) {
      console.log(`  Trying cookie file: ${path.basename(cFile)}...`);
      const saved = JSON.parse(fs.readFileSync(cFile, 'utf8'));
      
      const hostMatch = PARTS_QUERY_URL.match(/^https?:\/\/([^\/]+)/);
      const host = hostMatch ? hostMatch[1] : 'cck.uparts.info';
      const remapped = saved.map(c => ({ ...c, domain: host }));
      
      await page.setCookie(...remapped);
      try { await page.goto(PARTS_QUERY_URL, { waitUntil: 'domcontentloaded' }); } catch {}
      await sleep(1500);
      
      if (!(await needLogin())) {
        console.log(`✅ Successfully logged in using ${path.basename(cFile)}`);
        loggedIn = true;
        break;
      }
    }
  }

  // ── 如果既有 Session 全部失效，啟動「自動填寫帳密」自動登入 ─────────────────
  if (!loggedIn && (await needLogin())) {
    console.log('  🔑 Session 已過期，嘗試自動進行帳密登入 (car00401)...');
    
    let machineIdValue = null;
    for (const cFile of cookieCandidates) {
      if (fs.existsSync(cFile)) {
        try {
          const cookies = JSON.parse(fs.readFileSync(cFile, 'utf8'));
          const m = cookies.find(c => c.name === 'MachineId');
          if (m && m.value) { machineIdValue = m.value; break; }
        } catch {}
      }
    }

    const hostMatch = PARTS_QUERY_URL.match(/^https?:\/\/([^\/]+)/);
    const host = hostMatch ? hostMatch[1] : 'cck.uparts.info';

    if (machineIdValue) {
      await page.setCookie({
        name: 'MachineId',
        value: machineIdValue,
        domain: host,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 365
      });
      console.log(`  ✅ 已注入 MachineId 授權標記`);
    }

    const loginUrl = `http://${host}/SERVICE_CENTER/`;
    try { await page.goto(loginUrl, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(1500);

    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const textInputs = inputs.filter(i => i.type === 'text' || !i.type);
      const passwordInput = inputs.find(i => i.type === 'password');
      if (!passwordInput) return;
      passwordInput.value = '1';
      const [serviceInput, userInput] = textInputs;
      if (serviceInput) {
        serviceInput.value = 'car00401';
        serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
        serviceInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (userInput) {
        userInput.value = 'b9';
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      const btn = Array.from(document.querySelectorAll('input[type=submit], button, input[type=button]'))
        .find(b => /登入|login|確定/i.test(b.value || b.innerText || ''));
      if (btn) btn.click();
    }).catch(() => {});

    await sleep(4000);

    try { await page.goto(PARTS_QUERY_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(2000);

    if (!(await needLogin())) {
      console.log('🎉 自動帳密登入成功！已更新 Cookie。');
      const cookiesFile = path.join(__dirname, 'cookies.json');
      fs.writeFileSync(cookiesFile, JSON.stringify(await page.cookies(), null, 2));
      loggedIn = true;
    }
  }

  if (!loggedIn) {
    console.log('⚠️ 所有備用 Cookie 與自動登入皆失敗，可能需要先手動執行登入流程。');
  }

  const sqlPath = path.join(OUTPUT_DIR, 'update_legacy_photos.sql');
  if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);

  const sqlStatements = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`\n[${i + 1}/${products.length}] 正在抓取: ${p.name || p.p_id} (料號: ${p.p_id}) ...`);

    try {
      // 1. 到搜尋頁面搜尋這個料號
      await openWithRetry(page, PARTS_QUERY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
      const url = `${MEDIA_IFRAME_BASE}?KeyValue=${legacyGuid}&TableName=%E9%9B%B6%E4%BB%B6%E4%B8%BB%E6%AA%94&message=&TYPE_LABLE=&CHNAME_LABLE=`;
      
      await openWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
        execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/update_legacy_photos.sql --yes`, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        console.log('🎉 照片更新完成！');
    } catch (e) {
        console.log('❌ 更新至遠端資料庫失敗，請手動執行:');
        console.log(`npx wrangler d1 execute ${DB_NAME} --remote --file=output/update_legacy_photos.sql --yes`);
    }

  } else {
    console.log('⚠️ 沒有找到任何新照片可以更新。');
  }

})();
