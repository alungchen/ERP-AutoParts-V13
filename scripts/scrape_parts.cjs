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

const HOST          = process.env.UPARTS_HOST || 'cck2.uparts.info';
const BASE_URL     = `http://${HOST}/car2009/Default/`;
const PARTS_URL    = `http://${HOST}/car2009/parts_query/`;
const OUTPUT_DIR   = path.join(__dirname, '..', 'output');
const KEYWORDS_FILE = path.join(__dirname, '..', 'keywords.txt');

let searchTerms = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
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

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  // 啟動前進行自癒清理，以防鎖定衝突
  cleanChromeProfileLock(PROFILE_DIR);

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  const headlessArg = process.argv.includes('--headless');
  const browser = await puppeteer.launch({
    headless: headlessArg ? 'new' : false,
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    protocolTimeout: 1200000,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-extensions','--allow-running-insecure-content',
           '--ignore-certificate-errors','--disable-popup-blocking',
           '--no-proxy-server', '--proxy-server=direct://', '--proxy-bypass-list=*',
           '--unsafely-treat-insecure-origin-as-secure=http://cck2.uparts.info,http://cck.uparts.info',
           '--disable-features=HttpsFirstBalancedModeAutoEnable,HttpsUpgrades,HttpsOnlyMode,InsecurePrivateNetworkRequestsAllowed']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);

  // ── [1] 登入 ──────────────────────────────────────────────────────
  console.log('\n[1] Opening page...');

  const cookieCandidates = [
    path.join(__dirname, 'cookies.json'),
    path.join(__dirname, 'cookies_cck2_user.json'),
    path.join(__dirname, 'cookies_xizhi.json'),
    path.join(__dirname, 'cookies_songshan.json')
  ];

  const needLogin = async () => {
    try {
      return await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
        !document.querySelector('#btn_search')
      );
    } catch (e) {
      return true;
    }
  };

  let loggedIn = false;

  try { await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' }); } catch {}

  for (const cFile of cookieCandidates) {
    if (fs.existsSync(cFile)) {
      console.log(`  Trying cookie file: ${path.basename(cFile)}...`);
      try {
        const saved = JSON.parse(fs.readFileSync(cFile, 'utf8'));
        const remapped = saved.map(c => ({ ...c, domain: HOST }));
        await page.setCookie(...remapped);
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await ensurePageReady(page);
        await sleep(2000);
        
        if (!(await needLogin())) {
          console.log(`✅ Successfully logged in using ${path.basename(cFile)}`);
          if (cFile !== COOKIES_FILE) {
             fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
          }
          loggedIn = true;
          break;
        }
      } catch (err) {
        console.log(`  ⚠️ Cookie ${path.basename(cFile)} test failed: ${err.message}`);
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

    const hostMatch = BASE_URL.match(/^https?:\/\/([^\/]+)/);
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

    try { await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(2000);

    if (!(await needLogin())) {
      console.log('🎉 自動帳密登入成功！已更新 Cookie。');
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
      loggedIn = true;
    }
  }

  if (!loggedIn && (await needLogin())) {
    if (headlessArg) {
      console.error('\n❌ [Error] 登入狀態已失效 (Session Cookie expired)！無法在無頭模式下進行手動登入。');
      console.error('👉 請您在本機手動執行一次以下指令重新登入以刷新 Cookie：\n  node scripts/run_all.cjs\n');
      process.exit(2);
    }
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
    try { await page.goto(BASE_URL, { waitUntil: 'networkidle2' }); } catch {}
    await ensurePageReady(page);
    await sleep(3000);
  } else {
    console.log('[1] Already logged in ✓');
  }

  // ── [2] 搜尋 ──────────────────────────────────────────────────────
  const allMainRows   = [];
  const allCompatRows = [];

async function safeGoto(page, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(1500);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1000);
      await ensurePageReady(page);
      return true;
    } catch (e) {
      console.log(`  ⚠️ 頁面導航重試 (${attempt}/3): ${e.message}`);
      await sleep(2000);
    }
  }
  return false;
}

  for (const SEARCH_TERM of searchTerms) {
    let keywordResolved = false;
    let foundExactMatch = false;
    let firstNonExactRow = null; // 備用：若完全找不到精確符合，使用第一個非精確列資料
    try {
      await safeGoto(page, PARTS_URL);

      const cleanSearchTerm = SEARCH_TERM.replace(/\s+/g, '');
      console.log(`\n[2] Searching: "${SEARCH_TERM}" (clean: "${cleanSearchTerm}")`);
      await page.evaluate(term => {
        // 清空所有 ele_search_ 輸入框，防止舊搜尋條件（如車種 "MA3"、品名等）殘留干擾
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        inputs.forEach(i => {
          if ((i.id || '').startsWith('ele_search_')) {
            i.value = '';
            i.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        // 填入目標零件號碼
        const pNoInput = inputs.find(i => (i.id || '').startsWith('ele_search_'));
        if (pNoInput) {
          pNoInput.focus();
          pNoInput.value = term;
          pNoInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, cleanSearchTerm);
      await sleep(400);
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('#btn_search') || document.querySelector('input[value*="查詢"]');
          if (btn) btn.click();
        });
      } catch (e) {
        // 忽略 ASP.NET 表單送出引起的 Execution context was destroyed
      }
      await sleep(1500); // 等待 ASP.NET 表單送出與 DOM 渲染
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
            .filter(tr => tr.hasAttribute('row') && tr.querySelectorAll('td').length >= 4)
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
          // 找料號欄 (料號可能包含數字，例如 Z2R-001S)
          let pnIdx = -1;
          for (let ci = 0; ci < cells.length; ci++) {
            if (/^[A-Z0-9]{2,10}-[A-Z0-9-*_\s]{1,25}$/i.test(cells[ci]) || /^[A-Z0-9*_\s-]{3,25}$/i.test(cells[ci])) { 
                if (ci <= 3) {
                    pnIdx = ci; 
                    break; 
                }
            }
          }
          if (pnIdx < 0 && cells.length >= 8) {
              pnIdx = 1;
          }
          
          if (pnIdx < 0 || !cells[pnIdx]) continue;

          console.log(`  DEBUG CELLS (${cells.length}):`, JSON.stringify(cells));
          const partNo   = cells[pnIdx] || '';
          const carModel = (cells.length >= 25 ? cells[pnIdx + 3] : cells[pnIdx + 1]) || '';
          const year     = (cells.length >= 25 ? cells[pnIdx + 4] : cells[pnIdx + 2]) || '';
          const name     = (cells.length >= 25 ? cells[pnIdx + 5] : cells[pnIdx + 3]) || '';
          const spec     = (cells.length >= 25 ? cells[pnIdx + 6] : cells[pnIdx + 4]) || '';
          const brand    = (cells.length >= 25 ? cells[pnIdx + 7] : cells[pnIdx + 5]) || '';
          const notes    = (cells.length >= 25 ? cells[27] : cells[10]) || '';
          const priceB   = cells[pnIdx+20] || '0';
          const priceC   = cells[pnIdx+21] || '0';

          process.stdout.write(`  ${partNo.padEnd(18)} [row=${rowAttr}]`);
          allMainRows.push([partNo, name, brand, '0', spec, carModel, year, '0', '0', '0', notes]);
          const isExact = partNo.replace(/\s+/g, '').toLowerCase() === SEARCH_TERM.replace(/\s+/g, '').toLowerCase();
          if (isExact) {
            foundExactMatch = true;
          } else if (!firstNonExactRow) {
            // 記住第一個非精確符合列，只有在整個搜尋結束後完全沒有精確符合時才使用
            firstNonExactRow = { partNo, name, brand, spec, carModel, year, notes };
          }
          keywordResolved = true;

          try {
            if (!rowAttr) throw new Error('no row attr');

            let prevSrc = await page.evaluate(() =>
              document.querySelector('#iframe_partkey')?.src || '');

            await page.evaluate(rowAttr => {
              const tr = document.querySelector(`tr[row="${rowAttr}"]`);
              if (tr) {
                  tr.click();
                  const btn = document.querySelector('#btn_partkey');
                  if (btn) btn.click();
              }
            }, rowAttr).catch(() => {});

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
                }, rowAttr).catch(() => {});
                waitResult = await page.waitForFunction((old) => {
                  const src = document.querySelector('#iframe_partkey')?.src || '';
                  return src !== old && src.includes('partsID=');
                }, { timeout: 8000 }, prevSrc).catch(() => null);
            }

            await sleep(3000);

            const actualSrc = await page.evaluate(() =>
              document.querySelector('#iframe_partkey')?.src || '');

            if (actualSrc === prevSrc || !actualSrc.includes('partsID=')) {
              allCompatRows.push([partNo,'1',partNo,carModel,'',year,name,spec,brand,'']);
              console.log(` → (iframe unchanged, fallback)`);
              await sleep(ROW_DELAY);
              continue;
            }

            let compatData = [];
            let partkeyFrame = null;
            try {
                const el = await page.$('#iframe_partkey');
                if (el) partkeyFrame = await el.contentFrame();
            } catch(e) {}
            
            if (!partkeyFrame) {
                partkeyFrame = page.frames().find(f => {
                    try { return f.url().includes('product_info_partkey_big'); } catch(e) { return false; }
                });
            }

            if (partkeyFrame) {
              try {
                await partkeyFrame.waitForSelector('tr', { timeout: 5000 });
                await sleep(500);
                const frameUrl = partkeyFrame.url();

                compatData = await partkeyFrame.evaluate(() => {
                  const results = [];
                  for (const tr of document.querySelectorAll('tr')) {
                    const cells = Array.from(tr.cells).map(el => {
                      const inp = el.querySelector(
                        'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=hidden])'
                      );
                      return (inp ? inp.value : el.innerText).trim().replace(/\s+/g,' ');
                    });
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

            if (compatData.length > 0) {
              let added = 0;
              let isPrimary = true;
              for (const c of compatData) {
                if (c.slice(1, 6).some(v => /號碼|適用號碼|number/i.test(v))) continue;
                if (c.every(v => v === '')) continue;

                const compatNo = (c[2] || '').trim();
                allCompatRows.push([
                  partNo,
                  isPrimary ? '1' : '0',
                  compatNo,
                  c[3] || '',
                  c[4] || '',
                  c[5] || '',
                  c[6] || '',
                  c[7] || '',
                  c[8] || '',
                  c[9] || '',
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
    } catch (err) {
      console.log(`\n⚠️ 搜尋關鍵字 "${SEARCH_TERM}" 時發生中斷: ${err.message}`);
    }

    // ── 鏡像資料只在「搜尋完所有頁面後都沒有精確符合」時才加入一次 ──
    if (keywordResolved && !foundExactMatch && firstNonExactRow) {
      const { partNo, name, brand, spec, carModel, year, notes } = firstNonExactRow;
      console.log(`  ↳ 未找到精確符合 "${SEARCH_TERM}"，使用「${partNo}」資料建立對照`);
      allMainRows.push([SEARCH_TERM, name, brand, '0', spec, carModel, year, '0', '0', '0', `對照自: ${partNo}。 ${notes}`.trim()]);
    }

    if (!keywordResolved) {
      console.log(`  ⚠ 舊系統找不到 "${SEARCH_TERM}" 的規格。已自動新增為未尋獲規格佔位資料以防循環卡死。`);
      allMainRows.push([SEARCH_TERM, "舊系統無此規格", "N/A", "0", "查無資料", "無", "無", "0", "0", "0", "舊版系統查無此零件料號"]);
    }
  }

  // ── [5] 輸出 ──────────────────────────────────────────────────────
      console.log(`\n${'═'.repeat(50)}`);
      console.log('FINAL ALL MAIN ROWS:', JSON.stringify(allMainRows, null, 2));
      if (allMainRows.length > 0) {
          writeCSV(path.join(OUTPUT_DIR,'products_main.csv'),
            ['p_id','name','brand','stock','specifications','car_model','year','price_a','price_b','price_c','notes'],
            allMainRows);
          writeCSV(path.join(OUTPUT_DIR,'products_compatible.csv'),
            ['p_id','is_primary','compatible_number','car_model','vehicle_spec','year','product_name','product_spec','brand','note'],
            allCompatRows);
          console.log(`\n✅ 爬取已儲存！ Main: ${allMainRows.length}, Compatible: ${allCompatRows.length}`);
      }
      await browser.close();

  // ── [6] 自動轉換 SQL 並匯入資料庫 ──────────────────────────────────────
  console.log(`\n${'═'.repeat(50)}`);
  try {
    console.log('🔄 正在自動將 CSV 轉換為 SQL 並匯入 Cloudflare D1 資料庫...');
    console.log('  1. 產生 SQL 檔案...');
    execSync('node scripts/generate_import_sql.cjs --force', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    
    console.log('\n  2. 匯入遠端 D1 資料庫 (這可能需要幾十秒)...');
    execSync('npx wrangler d1 execute erp-db --remote --file=output/import_products.sql --yes', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    
    console.log('\n✅ 恭喜！所有爬取到的資料已成功匯入 ERP 遠端資料庫！');
  } catch (err) {
    console.error('\n❌ 匯入資料庫時發生錯誤：', err.message);
    console.log('您可以稍後手動執行以下指令來匯入：\n  node scripts/generate_import_sql.cjs\n  npx wrangler d1 execute erp-db --remote --file=output/import_products.sql --yes');
    process.exit(1);
  }

})().catch(err => { console.error('\n❌', err.message); process.exit(1); });
