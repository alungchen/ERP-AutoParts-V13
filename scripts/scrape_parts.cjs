/**
 * scrape_parts.cjs — v5 (直接呼叫 open_dialog_partkey)
 * 關鍵修正: 用 tr 的 row 屬性直接呼叫 open_dialog_partkey(rowNum)
 * 不靠 jQuery 列點擊，繞過 ui-state-active 問題
 */

const puppeteer = require('puppeteer');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const BASE_URL     = 'http://cck2.uparts.info/car2009/parts_query/';
const OUTPUT_DIR   = path.join(__dirname, '..', 'output');
const KEYWORDS_FILE = path.join(__dirname, '..', 'keywords.txt');

let searchTerms = process.argv.slice(2);
if (searchTerms.length === 0 && fs.existsSync(KEYWORDS_FILE)) {
  searchTerms = fs.readFileSync(KEYWORDS_FILE, 'utf8')
                  .split(/\r?\n/)
                  .map(s => s.trim())
                  .filter(s => s.length > 0);
}
if (searchTerms.length === 0) {
  searchTerms = ['com-b']; // fallback
}
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR  = path.join(__dirname, '.chrome-profile');
const ROW_DELAY    = 800;
const PAGE_DELAY   = 2500;
const LOGIN_WAIT   = 600;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function escapeCSV(val) {
  const s = String(val ?? '').trim();
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function ensurePageReady(page) {
  const isError = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return t.includes('502 Bad Gateway') || t.includes('Server Error') || t.includes('could not complete your request');
  });
  if (isError) {
    throw new Error('目標網站發生 502 Server Error 或崩潰！請稍後再試。');
  }
}

function writeCSV(filePath, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))];
  fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log(`  ✓ ${rows.length} rows → ${path.basename(filePath)}`);
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox','--disable-setuid-sandbox','--allow-running-insecure-content',
           '--ignore-certificate-errors','--disable-popup-blocking']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);

  // ── [1] 登入 ──────────────────────────────────────────────────────
  console.log('\n[1] Opening page...');
  try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
  await ensurePageReady(page);
  await sleep(2000);

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
    try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(2000);
  }

  const needLogin = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
    !document.querySelector('#btn_search')
  ).catch(() => true);

  if (await needLogin()) {
    await page.evaluate(() => {
      document.title = '🔴 請在此視窗登入！';
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f00;color:#fff;text-align:center;font-size:22px;font-weight:bold;padding:12px;';
      b.textContent = '⚠️ 爬蟲視窗：請在此登入！';
      document.body.prepend(b);
    }).catch(() => {});
    console.log('\n⚠️  請在開啟的 Chrome 視窗登入\n');
    for (let w = 0; w < LOGIN_WAIT; w += 3) {
      await sleep(3000);
      if (!(await needLogin())) { console.log(`✅ 登入成功 (${w+3}s)`); break; }
      if ((w+3) % 30 === 0) console.log(`  等待... (${w+3}s)`);
    }
    await sleep(2000);
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
    try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(2000);
  } else {
    console.log('[1] Already logged in ✓');
  }

  // ── [2] 搜尋 ──────────────────────────────────────────────────────
  const allMainRows   = [];
  const allCompatRows = [];

  for (const SEARCH_TERM of searchTerms) {
    try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(1500);

    console.log(`\n[2] Searching: "${SEARCH_TERM}"`);
  await page.evaluate(term => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]'))
      .find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.focus(); inp.value = term; inp.dispatchEvent(new Event('change',{bubbles:true})); }
  }, SEARCH_TERM);
  await sleep(400);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    page.evaluate(() => document.querySelector('#btn_search')?.click())
  ]);
  await sleep(1000); // Give it a moment to render
  await ensurePageReady(page);

  // ── [3] 頁數 ──────────────────────────────────────────────────────
  const totalPages = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/共\s*(\d+)\s*頁/);
    return m ? parseInt(m[1]) : 1;
  });
  const totalRecs = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/共\s*(\d+)\s*筆/);
    return m ? parseInt(m[1]) : '?';
  });
  console.log(`[3] ${totalRecs} records, ${totalPages} pages`);

  // ── [4] 爬取 ──────────────────────────────────────────────────────

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Page ${pageNum} / ${totalPages}`);

    // 讀取列資料，同時抓 tr 的 row 屬性
    const gridRows = await page.evaluate(() => {
      const container = document.querySelector('#display_DataGrid') || document.body;
      return Array.from(container.querySelectorAll('tr'))
        .filter(tr => tr.querySelectorAll('td').length >= 4)
        .map(tr => ({
          rowAttr: tr.getAttribute('row') || '',
          cells: Array.from(tr.querySelectorAll('td')).map(td => {
            const inp = td.querySelector('input[type="text"],input[type="number"],input:not([type])');
            return (inp ? inp.value : td.innerText).trim().replace(/\s+/g,' ');
          })
        }));
    });

    console.log(`  DOM rows: ${gridRows.length}`);

    for (const { rowAttr, cells } of gridRows) {
      // 找料號欄
      let pnIdx = -1;
      for (let ci = 0; ci < cells.length; ci++) {
        if (/^[A-Z]{2,10}-[A-Z0-9][A-Z0-9-]{0,20}$/i.test(cells[ci])) { pnIdx = ci; break; }
      }
      if (pnIdx < 0) continue;

      const partNo   = cells[pnIdx];
      const selfCode = cells[pnIdx+1]  || '';
      const carModel = cells[pnIdx+2]  || ''; // 車名 (CORONA 台規)
      const name     = cells[pnIdx+3]  || ''; // 品名 (壓縮機)
      const year     = '';                    // (Year is often empty or misplaced, leave blank for fallback)
      const spec     = cells[pnIdx+6]  || ''; // 規格 (1.6 10PA15C)
      const brand    = cells[pnIdx+7]  || ''; // 品牌 (新品)
      const priceB   = cells[pnIdx+8]  || '0';
      const priceC   = cells[pnIdx+9]  || '0';
      const notes    = cells[pnIdx+10] || '';

      process.stdout.write(`  ${partNo.padEnd(18)} [row=${rowAttr}]`);
      allMainRows.push([partNo, name, brand, '0', spec, carModel, year, '0', '0', '0', notes]);

      try {
        if (!rowAttr) throw new Error('no row attr');

        // 記錄目前 iframe src
        let prevSrc = await page.evaluate(() =>
          document.querySelector('#iframe_partkey')?.src || '');

        // 直接點擊該列然後點 btn_partkey，模擬真實使用者行為
        await page.evaluate(rowAttr => {
          const tr = document.querySelector(`tr[row="${rowAttr}"]`);
          if (tr) {
              tr.click();
              const btn = document.querySelector('#btn_partkey');
              if (btn) btn.click();
          }
        }, rowAttr);

        // 等 iframe src 更新
        let waitResult = await page.waitForFunction((old) => {
          const src = document.querySelector('#iframe_partkey')?.src || '';
          return src !== old && src.includes('partsID=');
        }, { timeout: 6000 }, prevSrc).catch(() => null);

        if (!waitResult) {
            console.log(`   [Retry opening iframe...]`);
            await page.evaluate(rowAttr => {
              const tr = document.querySelector(`tr[row="${rowAttr}"]`);
              if (tr) {
                  tr.click();
                  const btn = document.querySelector('#btn_partkey');
                  if (btn) btn.click();
              }
            }, rowAttr);
            waitResult = await page.waitForFunction((old) => {
              const src = document.querySelector('#iframe_partkey')?.src || '';
              return src !== old && src.includes('partsID=');
            }, { timeout: 8000 }, prevSrc).catch(() => null);
        }

        await sleep(3000); // 等 iframe 內容載入

        // ── 驗證 iframe src 確實有更新（排除 stale 資料）──────────────
        const actualSrc = await page.evaluate(() =>
          document.querySelector('#iframe_partkey')?.src || '');

        if (actualSrc === prevSrc || !actualSrc.includes('partsID=')) {
          // iframe 沒有更新（debounce/timeout），使用 fallback
          allCompatRows.push([partNo,'1',partNo,carModel,'',year,name,spec,brand,'']);
          console.log(` → (iframe unchanged, fallback)`);
          await sleep(ROW_DELAY);
          continue;
        }

        // 從 iframe 讀取資料
        let compatData = [];
        const partkeyFrame = page.frames().find(f => f.url().includes('product_info_partkey_big'));

        if (partkeyFrame) {
          try {
            await partkeyFrame.waitForSelector('tr', { timeout: 5000 });
            await sleep(500);
            const frameUrl = partkeyFrame.url();

            compatData = await partkeyFrame.evaluate(() => {
              const results = [];
              for (const tr of document.querySelectorAll('tr')) {
                // 使用 tr.cells 確保只抓取直屬的 td/th，不受巢狀表格干擾
                const cells = Array.from(tr.cells).map(el => {
                  const inp = el.querySelector(
                    'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=hidden])'
                  );
                  return (inp ? inp.value : el.innerText).trim().replace(/\s+/g,' ');
                });
                // 目標資料表格通常有 10 個欄位，如果大於 8 個就可以肯定是目標表格的列
                if (cells.length >= 8) {
                   results.push(cells);
                }
              }
              return results;
            });

            console.log(` [iframe: ${frameUrl.includes('partsID=') ? frameUrl.split('partsID=')[1].substring(0,8) : '?'}, rows=${compatData.length}]`);
          } catch (e) {
            console.log(` [frame-err: ${e.message.substring(0,40)}]`);
          }
        } else {
          console.log(` [no frame found]`);
        }

        // 處理適用資料
        // iframe 欄位結構（不 filter 空值後）:
        // c[0]='' c[1]=控制btn c[2]=適用號碼 c[3]=車種 c[4]=車種規格 c[5]=年份 c[6]=品名 c[7]=品名規格 c[8]=品牌 c[9]=備註
        if (compatData.length > 0) {
          let added = 0;
          let isPrimary = true;
          for (const c of compatData) {
            // 跳過 header 列（前 5 欄任一含「號碼」「適用」等 header 文字）
            if (c.slice(1, 6).some(v => /號碼|適用號碼|number/i.test(v))) continue;
            // 跳過完全空白列
            if (c.every(v => v === '')) continue;

            const compatNo = (c[2] || '').trim(); // 適用號碼
            allCompatRows.push([
              partNo,
              isPrimary ? '1' : '0',
              compatNo,   // 適用號碼
              c[3] || '', // 車種
              c[4] || '', // 車種規格
              c[5] || '', // 年份
              c[6] || '', // 品名
              c[7] || '', // 品名規格
              c[8] || '', // 品牌
              c[9] || '', // 備註
            ]);
            isPrimary = false;
            added++;
          }
          console.log(` → ${added} compat`);
          if (added === 0) {
            allCompatRows.push([partNo,'1',partNo,carModel,'',year,name,spec,brand,'']);
          }
        } else {
          allCompatRows.push([partNo,'1',partNo,carModel,'',year,name,spec,brand,'']);
          console.log(` → (no iframe data)`);
        }

      } catch (err) {
        allCompatRows.push([partNo,'1',partNo,carModel,'',year,name,spec,brand,'']);
        console.log(` → ERR: ${err.message.substring(0,50)}`);
      }

      await sleep(ROW_DELAY);
    }

    // 翻頁
    if (pageNum < totalPages) {
      console.log(`\n  → Page ${pageNum+1}...`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.evaluate(() => document.querySelector('#btn_PageControl_PageNext')?.click())
      ]);
      await sleep(1000);
      await ensurePageReady(page);
    }
    }
  }

  // ── [5] 輸出 ──────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  writeCSV(path.join(OUTPUT_DIR,'products_main.csv'),
    ['p_id','name','brand','stock','specifications','car_model','year','price_a','price_b','price_c','notes'],
    allMainRows);
  writeCSV(path.join(OUTPUT_DIR,'products_compatible.csv'),
    ['p_id','is_primary','compatible_number','car_model','vehicle_spec','year','product_name','product_spec','brand','note'],
    allCompatRows);

  console.log(`\n✅ Done scraping! Main: ${allMainRows.length}, Compatible: ${allCompatRows.length}`);
  await browser.close();

  // ── [6] 自動轉換 SQL 並匯入資料庫 ──────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  try {
    console.log('🔄 正在自動將 CSV 轉換為 SQL 並匯入 Cloudflare D1 資料庫...');
    console.log('  1. 產生 SQL 檔案...');
    const forceFlag = process.argv.includes('--force') ? ' --force' : '';
    execSync(`node scripts/generate_import_sql.cjs${forceFlag}`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    
    console.log('\n  2. 匯入遠端 D1 資料庫 (這可能需要幾十秒)...');
    execSync('npx wrangler d1 execute erp-db --remote --file=output/import_products.sql', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    
    console.log('\n✅ 恭喜！所有爬取到的資料已成功匯入 ERP 遠端資料庫！');
  } catch (err) {
    console.error('\n❌ 匯入資料庫時發生錯誤：', err.message);
    console.log('您可以稍後手動執行以下指令來匯入：\n  node scripts/generate_import_sql.cjs\n  npx wrangler d1 execute erp-db --remote --file=output/import_products.sql');
  }

})().catch(err => { console.error('\n❌', err.message); process.exit(1); });
