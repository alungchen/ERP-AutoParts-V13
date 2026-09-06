const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const DB_NAME = 'erp-db'; // 你的 D1 資料庫名稱
const PRIMARY_COOKIES_FILE = path.join(__dirname, 'cookies_cck.json');
const FALLBACK_COOKIES_FILE = path.join(__dirname, 'cookies.json');
// 獨立 profile；換目錄避免舊 profile 把 cck2 鎖成 HTTPS redirect 迴圈
const PROFILE_DIR = path.join(__dirname, '.chrome-profile-legacy-photos-http');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const HOST_CANDIDATES = [...new Set(
  [process.env.UPARTS_HOST, 'cck2.uparts.info', 'cck.uparts.info'].filter(Boolean)
)];
let HOST = HOST_CANDIDATES[0];
let PARTS_QUERY_URL = '';
let MEDIA_IFRAME_BASE = '';
function applyHost(h) {
  HOST = h;
  PARTS_QUERY_URL = `http://${HOST}/car2009/parts_query/`;
  MEDIA_IFRAME_BASE = `http://${HOST}/car2009/Iframe_MEDIA_List/`;
}
applyHost(HOST);

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
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--no-proxy-server',
      '--proxy-server=direct://',
      '--proxy-bypass-list=*',
      '--unsafely-treat-insecure-origin-as-secure=http://cck2.uparts.info,http://cck.uparts.info',
      '--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades,HttpsOnlyMode,HttpsFirstModeV2',
    ]
  });
  const page = await browser.newPage();

  const cookieCandidates = [
    path.join(__dirname, 'cookies.json'),
    path.join(__dirname, 'cookies_cck.json'),
    path.join(__dirname, 'cookies_cck2.json'),
    path.join(__dirname, 'cookies_cck2_user.json'),
    path.join(__dirname, 'cookies_xizhi.json'),
    path.join(__dirname, 'cookies_songshan.json')
  ];

  const partsQueryReady = () => page.evaluate(() => !!document.querySelector('#btn_search')).catch(() => false);

  async function openPartsQuery() {
    await page.goto(PARTS_QUERY_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(1200);
    return partsQueryReady();
  }

  async function tryCookiesOnHost(host) {
    applyHost(host);
    console.log(`\n🔗 嘗試主機 ${HOST}`);
    try { await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch {}
    for (const cFile of cookieCandidates) {
      if (!fs.existsSync(cFile)) continue;
      console.log(`  Trying cookie file: ${path.basename(cFile)}...`);
      try {
        const saved = JSON.parse(fs.readFileSync(cFile, 'utf8'));
        const remapped = saved.map((c) => ({ ...c, domain: HOST }));
        await page.setCookie(...remapped);
        if (await openPartsQuery()) {
          console.log(`✅ 已登入（${path.basename(cFile)} @ ${HOST}）`);
          return true;
        }
        console.log(`  ✗ ${path.basename(cFile)} 未能進入零件查詢頁`);
      } catch (err) {
        console.log(`  ⚠️ ${path.basename(cFile)}: ${String(err.message || '').split('\n')[0].slice(0, 160)}`);
      }
    }
    return false;
  }

  async function tryAutoLogin() {
    console.log(`  🔑 Session 已過期，嘗試自動帳密登入 (car00401 @ ${HOST})...`);
    let machineIdValue = null;
    for (const cFile of cookieCandidates) {
      if (!fs.existsSync(cFile)) continue;
      try {
        const cookies = JSON.parse(fs.readFileSync(cFile, 'utf8'));
        const m = cookies.find((c) => c.name === 'MachineId');
        if (m && m.value) { machineIdValue = m.value; break; }
      } catch {}
    }
    if (machineIdValue) {
      await page.setCookie({
        name: 'MachineId',
        value: machineIdValue,
        domain: HOST,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 365
      });
      console.log('  ✅ 已注入 MachineId 授權標記');
    }
    try { await page.goto(`http://${HOST}/SERVICE_CENTER/`, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(1500);
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const textInputs = inputs.filter((i) => i.type === 'text' || !i.type);
      const passwordInput = inputs.find((i) => i.type === 'password');
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
        .find((b) => /登入|login|確定/i.test(b.value || b.innerText || ''));
      if (btn) btn.click();
    }).catch(() => {});
    await sleep(4000);
    try {
      if (await openPartsQuery()) {
        console.log('🎉 自動帳密登入成功！已更新 Cookie。');
        fs.writeFileSync(path.join(__dirname, 'cookies.json'), JSON.stringify(await page.cookies(), null, 2));
        return true;
      }
    } catch (err) {
      console.log(`  ⚠️ 自動登入後進入查詢頁失敗: ${String(err.message || '').split('\n')[0]}`);
    }
    return false;
  }

  let loggedIn = false;
  for (const host of HOST_CANDIDATES) {
    if (await tryCookiesOnHost(host)) { loggedIn = true; break; }
    if (await tryAutoLogin()) { loggedIn = true; break; }
  }

  if (!loggedIn) {
    console.log('❌ 無法進入零件查詢頁（redirect / 未登入）。請先執行 npm run open:cck2 登入後再跑。');
    await browser.close();
    process.exit(2);
  }

  const sqlPath = path.join(OUTPUT_DIR, 'update_legacy_photos.sql');
  if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);

  const sqlStatements = [];
  let redirectFails = 0;
  let switchedHost = false;

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

      const isPhotoUrl = (src) => {
        const s = String(src || '').trim();
        if (!s || s.startsWith('data:') || /\.js(\?|$)/i.test(s) || s.includes('fancybox') || s.includes('blank.gif')) return false;
        return /media\d?\.uparts\.info/i.test(s) || /\/Upload\//i.test(s) || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s) || /^https?:\/\//i.test(s) && /parts\//i.test(s);
      };

      const collectMediaUrls = () => {
        const urls = [];
        const del = document.querySelector('#btn_刪除連結');
        const delUrl = del?.getAttribute('url') || '';
        if (delUrl) urls.push(delUrl);
        for (const img of document.querySelectorAll('img')) {
          if (img.src) urls.push(img.src);
        }
        for (const el of document.querySelectorAll('#btn_刪除連結, a[href*="media2"], img')) {
          const u = el.getAttribute('url') || el.getAttribute('href') || el.getAttribute('src') || '';
          if (u) urls.push(u);
        }
        return urls;
      };

      const realPhotosFrom = (list) => [...new Set((list || []).filter(isPhotoUrl))];
      const fixJsEscapeUrl = (u) => String(u || '').replace(/%u([0-9A-Fa-f]{4})/g, (_, hex) =>
        encodeURIComponent(String.fromCharCode(parseInt(hex, 16)))
      );

      // 點搜尋列「圖片」開 overlay iframe
      await page.evaluate(() => {
        const mediaBtn = document.querySelector('.media_count[partsid]');
        if (mediaBtn) mediaBtn.click();
        const btn = document.querySelector('input[value="圖片"]');
        if (btn) {
          const onclick = btn.getAttribute('onclick');
          if (onclick) eval(onclick);
          else btn.click();
        }
      });
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('iframe')).some((i) => (i.src || '').includes('Iframe_MEDIA_List')),
        { timeout: 8000 }
      ).catch(() => {});
      await sleep(2000);

      let uniqueUrls = [];
      const mediaFrame = page.frames().find((f) => {
        try { return (f.url() || '').includes('Iframe_MEDIA_List'); } catch { return false; }
      });
      const overlayUrl = mediaFrame ? mediaFrame.url() : '';
      if (overlayUrl) {
        const mediaUrl = fixJsEscapeUrl(overlayUrl);
        console.log(`  - 媒體頁: ${mediaUrl}`);
        await openWithRetry(page, mediaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(2000);
        uniqueUrls = realPhotosFrom(await page.evaluate(collectMediaUrls));
        for (const f of page.frames()) {
          const fu = (() => { try { return f.url() || ''; } catch { return ''; } })();
          if (!fu.includes('Iframe_MEDIA')) continue;
          try {
            uniqueUrls = realPhotosFrom([...uniqueUrls, ...(await f.evaluate(collectMediaUrls))]);
          } catch {}
        }
        if (uniqueUrls.length === 0) {
          const delMeta = await page.evaluate(() => {
            const del = document.querySelector('#btn_刪除連結');
            return {
              url: del?.getAttribute('url') || '',
              mediaid: del?.getAttribute('mediaid') || '',
              imgs: Array.from(document.querySelectorAll('img')).map((img) => img.src).slice(0, 8),
            };
          });
          console.log('  - 媒體頁除錯', JSON.stringify(delMeta));
          if (delMeta.url) uniqueUrls = realPhotosFrom([delMeta.url, ...delMeta.imgs]);
        }
      }

      if (uniqueUrls.length === 0) {
        const url = `${MEDIA_IFRAME_BASE}?KeyValue=${legacyGuid}&TableName=${encodeURIComponent('零件主檔')}&message=&TYPE_LABLE=&CHNAME_LABLE=`;
        console.log(`  - 改直開媒體頁: ${url}`);
        await openWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(2000);
        uniqueUrls = realPhotosFrom(await page.evaluate(collectMediaUrls));
      }

      console.log(`  🔍 Debug: 真實照片 ${uniqueUrls.length} 張`, uniqueUrls);

      if (uniqueUrls.length > 0) {
        redirectFails = 0;
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
      const msg = String(err.message || '');
      console.log(`  ❌ 抓取失敗: ${msg}`);
      if (msg.includes('ERR_TOO_MANY_REDIRECTS')) {
        redirectFails++;
        const nextHost = HOST_CANDIDATES.find((h) => h !== HOST);
        if (redirectFails >= 2 && nextHost && !switchedHost) {
          switchedHost = true;
          console.log(`\n⚠️ 連續 redirect，改連 ${nextHost} ...`);
          if ((await tryCookiesOnHost(nextHost)) || (await tryAutoLogin())) {
            redirectFails = 0;
            i -= 1;
            continue;
          }
        }
        if (redirectFails >= 2) {
          console.log('❌ 零件查詢頁持續 redirect，停止以免空轉。請先 npm run open:cck2 登入後再跑。');
          break;
        }
      } else {
        redirectFails = 0;
      }
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
