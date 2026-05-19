const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://cck.uparts.info/car2009/Default/';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR = path.join(__dirname, '.chrome-profile');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-popup-blocking']
  });

  const page = await browser.newPage();

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  // login check
  const needLogin = await page.evaluate(() => document.querySelectorAll('input[type="password"]').length > 0);
  if (needLogin) {
    console.log("需要手動登入！請在開啟的視窗登入。");
    await sleep(20000); // 留20秒登入
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
  }

  console.log("搜尋 COM-T016T ...");
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.focus(); inp.value = 'COM-T016T'; inp.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  await sleep(500);
  await page.evaluate(() => document.querySelector('#btn_search')?.click());
  await sleep(4000); // 等待結果

  console.log("抓取列的 HTML...");
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr')).filter(tr => tr.innerText.includes('COM-T016T')).map(tr => tr.outerHTML);
  });
  
  fs.writeFileSync(path.join(__dirname, 'row_dump.html'), rows.join('\n\n'));
  console.log("已儲存至 row_dump.html");

  await browser.close();
})();
