/** 探測片語頁的表頭與分頁器 DOM（只讀取） */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'cck2.uparts.info';
const URL = process.argv[2] || `http://${HOST}/car2009/Brand_Query2/`;

(async () => {
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
  await page.goto(URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
    page.evaluate(() => document.querySelector('#btn_search')?.click()),
  ]);
  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    // 所有含 th 的列
    const thRows = Array.from(document.querySelectorAll('tr'))
      .filter(tr => tr.querySelectorAll('th').length > 0)
      .map(tr => Array.from(tr.querySelectorAll('th')).map(th => th.innerText.trim()));
    // 資料列的第一列 class / 結構
    const firstDataRow = document.querySelector('tr[row]');
    const gridId = firstDataRow ? (firstDataRow.closest('table')?.id || firstDataRow.closest('div[id]')?.id || '(無)') : '(無)';
    // 表頭列可能在資料表上方的獨立 table
    const headerCandidates = Array.from(document.querySelectorAll('tr'))
      .filter(tr => (tr.innerText || '').includes('代碼'))
      .slice(0, 3)
      .map(tr => ({
        cells: Array.from(tr.cells || []).map(c => ({ tag: c.tagName, text: c.innerText.trim().replace(/\s+/g, '') })),
        tableId: tr.closest('table')?.id || '',
      }));
    // 分頁器
    const pagerText = (document.body.innerText.match(/第.{0,10}頁.{0,20}/) || [''])[0];
    const pageNum = document.querySelector('#ele_PageControl_PageNum')?.value;
    const pageSize = document.querySelector('#ele_PageControl_PageSize')?.value;
    const rowNo = document.querySelector('#ele_PageControl_RowNo')?.value;
    // 附近可能有總筆數 hidden input
    const hiddens = Array.from(document.querySelectorAll('input[type=hidden], input'))
      .filter(i => /count|total|row/i.test(i.id))
      .map(i => ({ id: i.id, value: i.value }));
    return { thRows: thRows.slice(0, 3), gridId, headerCandidates, pagerText, pageNum, pageSize, rowNo, hiddens };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
