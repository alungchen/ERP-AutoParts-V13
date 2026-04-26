/**
 * scrape_parts.cjs — v5 (直接呼叫 open_dialog_partkey)
 * 關鍵修正: 用 tr 的 row 屬性直接呼叫 open_dialog_partkey(rowNum)
 * 不靠 jQuery 列點擊，繞過 ui-state-active 問題
 */

const puppeteer = require('puppeteer');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const BASE_URL     = 'http://cck2.uparts.info/car2009/parts_query/';
const SEARCH_TERM  = 'com-b';
const OUTPUT_DIR   = path.join(__dirname, '..', 'output');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR  = path.join(__dirname, '.chrome-profile');
const ROW_DELAY    = 300;
const PAGE_DELAY   = 2500;
const LOGIN_WAIT   = 600;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function escapeCSV(val) {
  const s = String(val ?? '').trim();
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
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
  await sleep(2000);

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
    try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
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
    await sleep(2000);
  } else {
    console.log('[1] Already logged in ✓');
  }

  // ── [2] 搜尋 ──────────────────────────────────────────────────────
  console.log(`\n[2] Searching: "${SEARCH_TERM}"`);
  await page.evaluate(term => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]'))
      .find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.focus(); inp.value = term; inp.dispatchEvent(new Event('change',{bubbles:true})); }
  }, SEARCH_TERM);
  await sleep(400);
  await page.evaluate(() => document.querySelector('#btn_search')?.click());
  await sleep(PAGE_DELAY);

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
  const allMainRows   = [];
  const allCompatRows = [];

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
      const carModel = cells[pnIdx+1]  || '';
      const year     = cells[pnIdx+2]  || '';
      const name     = cells[pnIdx+3]  || '';
      const spec     = cells[pnIdx+4]  || '';
      const brand    = cells[pnIdx+5]  || '';
      const stock    = cells[pnIdx+6]  || '0';
      const priceA   = cells[pnIdx+7]  || '0';
      const priceB   = cells[pnIdx+8]  || '0';
      const priceC   = cells[pnIdx+9]  || '0';
      const notes    = cells[pnIdx+10] || '';

      process.stdout.write(`  ${partNo.padEnd(18)} [row=${rowAttr}]`);
      allMainRows.push([partNo, name, brand, stock, spec, carModel, year, priceA, priceB, priceC, notes]);

      try {
        if (!rowAttr) throw new Error('no row attr');

        // 記錄目前 iframe src
        const prevSrc = await page.evaluate(() =>
          document.querySelector('#iframe_partkey')?.src || '');

        // 直接呼叫 open_dialog_partkey(rowNum)
        await page.evaluate(rowNum => {
          if (typeof open_dialog_partkey === 'function') {
            open_dialog_partkey(parseInt(rowNum));
          }
        }, rowAttr);

        // 等 iframe src 更新
        await page.waitForFunction((old) => {
          const src = document.querySelector('#iframe_partkey')?.src || '';
          return src !== old && src.includes('partsID=');
        }, { timeout: 8000 }, prevSrc).catch(() => {});

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
              let bestTable = null, bestCount = 0;
              for (const t of document.querySelectorAll('table')) {
                const cnt = t.querySelectorAll('tr').length;
                if (cnt > bestCount) { bestCount = cnt; bestTable = t; }
              }
              if (!bestTable) return results;

              for (const tr of bestTable.querySelectorAll('tr')) {
                // 不 filter 空欄位 → 保持欄位位置正確
                const cells = Array.from(tr.querySelectorAll('td,th')).map(el => {
                  const inp = el.querySelector(
                    'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=hidden])'
                  );
                  return (inp ? inp.value : el.innerText).trim().replace(/\s+/g,' ');
                });
                if (cells.length >= 3) results.push(cells);
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
      await page.evaluate(() => document.querySelector('#btn_PageControl_PageNext')?.click());
      console.log(`\n  → Page ${pageNum+1}...`);
      await sleep(PAGE_DELAY);
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

  console.log(`\n✅ Done! Main: ${allMainRows.length}, Compatible: ${allCompatRows.length}`);
  await browser.close();

})().catch(err => { console.error('\n❌', err.message); process.exit(1); });
