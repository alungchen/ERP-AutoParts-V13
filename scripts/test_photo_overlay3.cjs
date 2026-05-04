const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://cck2.uparts.info/car2009/parts_query/';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure().errorText));

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  console.log("搜尋 COM-T016T ...");
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.focus(); inp.value = 'COM-T016T'; inp.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  await sleep(500);
  await page.evaluate(() => document.querySelector('#btn_search')?.click());
  await sleep(3000);

  console.log("執行 ShowMedia...");
  await page.evaluate(() => {
    const btn = document.querySelector('input[value="圖片"]');
    if (btn) {
      eval(btn.getAttribute('onclick'));
    } else {
      console.log('Button not found');
    }
  });

  await sleep(5000);

  await browser.close();
})();
