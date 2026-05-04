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

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const scriptContent = await page.evaluate(() => {
    return Array.from(document.scripts).map(s => s.innerText).find(text => text.includes('function ShowMedia'));
  });

  if (scriptContent) {
    fs.writeFileSync(path.join(__dirname, 'showmedia_def.js'), scriptContent);
    console.log("找到 ShowMedia 原始碼！");
  } else {
    // 也許在另一個 js 檔案裡，把包含 ShowMedia 的 external js url 找出來
    const scriptSrcs = await page.evaluate(() => {
        return Array.from(document.scripts).map(s => s.src).filter(src => src);
    });
    fs.writeFileSync(path.join(__dirname, 'showmedia_def.js'), "Not in inline scripts. Script sources: \n" + scriptSrcs.join("\n"));
    console.log("沒找到 inline ShowMedia，已記錄外部 script srcs");
  }

  await browser.close();
})();
