/**
 * scrape_shorthands.cjs — 抓取舊系統（cck2）片語資料
 *
 * 目標頁面：
 *   車型片語  /car2009/Type_Query2/
 *   品名片語  /car2009/Chname_Query2/
 *   品牌片語  /car2009/Brand_Query2/
 *
 * 流程：注入既有 Session → 開頁 → 調大每頁筆數 → 按「查詢」→ 逐頁抓取 → 輸出 CSV
 *
 * 用法:
 *   node scripts/scrape_shorthands.cjs              # 三種全抓
 *   node scripts/scrape_shorthands.cjs --only=model # 只抓車型（model|part|brand）
 *   node scripts/scrape_shorthands.cjs --headless   # 無頭模式（預設就是無頭）
 *
 * 輸出:
 *   output/shorthand_model.csv
 *   output/shorthand_part.csv
 *   output/shorthand_brand.csv
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'cck2.uparts.info';
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const PAGE_SIZE = 200;

const COOKIE_CANDIDATES = [
  path.join(__dirname, 'cookies_cck2_user.json'),
  path.join(__dirname, 'cookies_xizhi.json'),
  path.join(__dirname, 'cookies_songshan.json'),
];

const TARGETS = [
  { key: 'model', label: '車型片語', url: `http://${HOST}/car2009/Type_Query2/` },
  { key: 'part',  label: '品名片語', url: `http://${HOST}/car2009/Chname_Query2/` },
  { key: 'brand', label: '品牌片語', url: `http://${HOST}/car2009/Brand_Query2/` },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function escapeCSV(val) {
  const s = String(val ?? '').trim();
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeCSV(filePath, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))];
  fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log(`  💾 ${rows.length} 筆 → ${path.basename(filePath)}`);
}

async function extractGrid(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#DataGridDetail') || document.body;
    // 表頭：DataGridDetail 內第一個「沒有 row 屬性、且含『代碼』字樣」的列
    let headers = [];
    for (const tr of container.querySelectorAll('tr')) {
      if (tr.hasAttribute('row')) continue;
      const texts = Array.from(tr.cells || []).map(c => c.innerText.trim().replace(/\s+/g, ''));
      if (texts.length >= 3 && texts.includes('代碼')) {
        headers = texts.map((t, i) => t || `col${i}`);
        break;
      }
    }
    // 資料列（tr 具有 row 屬性）
    const rows = Array.from(container.querySelectorAll('tr'))
      .filter(tr => tr.hasAttribute('row') && tr.querySelectorAll('td').length >= 3)
      .map(tr => Array.from(tr.cells).map(td => {
        const inp = td.querySelector('input[type=text], input[type=number], input:not([type]), textarea');
        return (inp ? inp.value : td.innerText).trim().replace(/\s+/g, ' ');
      }));
    return { headers, rows };
  });
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const only = parseArg('only');

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    protocolTimeout: 1200000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-proxy-server', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on('dialog', async d => { console.log(`  ⚠️ 對話框: ${d.message()}`); await d.accept().catch(() => {}); });

  // ── 登入：依序嘗試各 Cookie 來源 ──────────────────────────────────
  let loggedIn = false;
  for (const cookieFile of COOKIE_CANDIDATES) {
    if (!fs.existsSync(cookieFile)) continue;
    try { await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' }); } catch {}
    const saved = JSON.parse(fs.readFileSync(cookieFile, 'utf8')).map(c => ({ ...c, domain: HOST }));
    try { await page.setCookie(...saved); } catch { continue; }
    try { await page.goto(`http://${HOST}/car2009/Default/`, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(2000);
    const ok = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
      (document.body?.innerText || '').includes('系統登出')
    ).catch(() => false);
    if (ok) {
      console.log(`🔐 已使用 ${path.basename(cookieFile)} 的登入狀態`);
      loggedIn = true;
      break;
    }
  }
  if (!loggedIn) {
    console.error('❌ 所有 Cookie 的登入狀態都已失效，請先執行 npm run open:cck2 登入一次。');
    await browser.close();
    process.exit(2);
  }

  // ── 逐一抓取三種片語 ──────────────────────────────────────────────
  const summary = [];
  for (const target of TARGETS) {
    if (only && only !== target.key) continue;
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📋 ${target.label} (${target.url})`);

    try { await page.goto(target.url, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(2000);

    // 調大每頁筆數 → 按查詢
    await page.evaluate((size) => {
      const el = document.querySelector('#ele_PageControl_PageSize');
      if (el) { el.value = String(size); el.dispatchEvent(new Event('change', { bubbles: true })); }
    }, PAGE_SIZE).catch(() => {});
    await sleep(300);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.evaluate(() => document.querySelector('#btn_search')?.click()),
    ]);
    await sleep(2500);

    // 頁面沒有「共N頁」資訊 → 逐頁翻到沒有新資料為止
    let headers = [];
    const allRows = [];
    const seen = new Set();
    const MAX_PAGES = 500;

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      const { headers: h, rows } = await extractGrid(page);
      if (h.length > 0 && headers.length === 0) headers = h;

      let added = 0;
      for (const cells of rows) {
        const key = cells.join('|');
        if (seen.has(key)) continue;
        // 跳過整列空白（新增列佔位）
        if (cells.every(c => c === '' || /^\d+$/.test(c))) continue;
        seen.add(key);
        allRows.push(cells);
        added++;
      }
      console.log(`  第 ${pageNum} 頁：DOM ${rows.length} 列，新增 ${added} 筆（累計 ${allRows.length}）`);

      // 本頁沒有任何新資料 → 已到最後一頁
      if (added === 0 && pageNum > 1) break;

      const before = await page.evaluate(() =>
        document.querySelector('#ele_PageControl_PageNum')?.value || '').catch(() => '');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.evaluate(() => document.querySelector('#btn_PageControl_PageNext')?.click()),
      ]);
      await sleep(1800);
      const after = await page.evaluate(() =>
        document.querySelector('#ele_PageControl_PageNum')?.value || '').catch(() => '');
      if (before && after && before === after) {
        // 頁碼沒有前進 → 已到最後一頁
        break;
      }
    }

    if (headers.length === 0 && allRows.length > 0) {
      headers = allRows[0].map((_, i) => `col${i}`);
    }
    const outFile = path.join(OUTPUT_DIR, `shorthand_${target.key}.csv`);
    writeCSV(outFile, headers, allRows);
    summary.push({ label: target.label, count: allRows.length, headers: headers.join(' | ') });
    await sleep(1000);
  }

  await browser.close();

  console.log(`\n${'═'.repeat(50)}`);
  console.log('✅ 全部完成！');
  for (const s of summary) {
    console.log(`  ${s.label}: ${s.count} 筆（欄位: ${s.headers}）`);
  }
})().catch(err => { console.error('\n❌ 失敗:', err.message); process.exit(1); });
