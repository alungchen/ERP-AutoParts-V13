const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MEDIA_URL = 'http://cck2.uparts.info/car2009/Iframe_MEDIA_List/?KeyValue=7BA007A3-4869-4713-8164-88058D8327B5&TableName=%E9%9B%B6%E4%BB%B6%E4%B8%BB%E6%AA%94';
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

  await page.goto(MEDIA_URL, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  const html = await page.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(__dirname, 'media_frame.html'), html);
  console.log("已儲存 iframe HTML");

  await browser.close();
})();
