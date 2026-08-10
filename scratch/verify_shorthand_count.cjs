/** 全量翻頁比對舊系統車型片語 vs 抓回的 CSV（只讀取） */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'cck2.uparts.info';
const TYPE = process.argv[2] || 'model';
const PAGE_PATH = { model: 'Type_Query2', part: 'Chname_Query2', brand: 'Brand_Query2' }[TYPE] || 'Type_Query2';
const CSV_FILE = { model: 'shorthand_model.csv', part: 'shorthand_part.csv', brand: 'shorthand_brand.csv' }[TYPE];

(async () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'output', CSV_FILE), 'utf8');
  const lines = t.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const csvCodes = new Set(lines.slice(1).map(l => (l.split(',')[2] || '').trim().toUpperCase()).filter(Boolean));
  console.log(`CSV(${CSV_FILE}): ${lines.length - 1} 筆，唯一代碼 ${csvCodes.size} 個`);

  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'cookies_cck2_user.json'), 'utf8'))
    .map(c => ({ ...c, domain: HOST }));
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.setCookie(...saved);
  await page.goto(`http://${HOST}/car2009/${PAGE_PATH}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const size = document.querySelector('#ele_PageControl_PageSize');
    if (size) { size.value = '500'; size.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await new Promise(r => setTimeout(r, 300));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    page.evaluate(() => document.querySelector('#btn_search')?.click()),
  ]);
  await new Promise(r => setTimeout(r, 3000));

  const getRows = () => page.evaluate(() => {
    const container = document.querySelector('#DataGridDetail') || document.body;
    return Array.from(container.querySelectorAll('tr'))
      .filter(tr => tr.hasAttribute('row') && tr.querySelectorAll('td').length >= 3)
      .map(tr => Array.from(tr.cells).map(td => {
        const inp = td.querySelector('input[type=text], input:not([type])');
        return (inp ? inp.value : td.innerText).trim();
      }));
  });
  const getPageNum = () => page.evaluate(() => document.querySelector('#ele_PageControl_PageNum')?.value || '');

  const all = new Map();
  let pageNo = 1;
  while (pageNo < 100) {
    const rows = await getRows();
    let added = 0;
    for (const cells of rows) {
      const code = (cells[2] || '').trim();
      if (!code) continue;
      if (!all.has(code.toUpperCase())) { all.set(code.toUpperCase(), cells); added++; }
    }
    const numBefore = await getPageNum();
    console.log(`第 ${pageNo} 頁（顯示頁碼 ${numBefore}）：${rows.length} 列，新增 ${added}，累計 ${all.size}`);
    if (rows.length === 0 && pageNo > 1) break;
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.evaluate(() => document.querySelector('#btn_PageControl_PageNext')?.click()),
    ]);
    await new Promise(r => setTimeout(r, 2500));
    const numAfter = await getPageNum();
    if (numAfter === numBefore && added === 0) break;
    if (numAfter === numBefore && pageNo > 1) {
      // 頁碼沒前進，再確認一次是否為最後一頁
      const rows2 = await getRows();
      const newOnes = rows2.filter(c => c[2] && !all.has(c[2].trim().toUpperCase())).length;
      if (newOnes === 0) break;
    }
    pageNo++;
  }

  console.log(`\n舊系統全量：唯一代碼 ${all.size} 個`);
  const missing = [...all.keys()].filter(c => !csvCodes.has(c));
  const extra = [...csvCodes].filter(c => !all.has(c));
  console.log(`舊系統有但 CSV 沒有（漏抓）: ${missing.length} 個`);
  if (missing.length) console.log(missing.slice(0, 100).join(', '));
  console.log(`CSV 有但舊系統沒有: ${extra.length} 個`);
  if (extra.length) console.log(extra.slice(0, 50).join(', '));

  fs.writeFileSync(path.join(__dirname, `server_codes_${TYPE}.json`), JSON.stringify([...all.values()], null, 1), 'utf8');
  await browser.close();
})();
