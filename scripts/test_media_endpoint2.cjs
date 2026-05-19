const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MEDIA_URL = 'http://cck.uparts.info/car2009/Iframe_MEDIA_List/?KeyValue=7BA007A3-4869-4713-8164-88058D8327B5&TableName=%E9%9B%B6%E4%BB%B6%E4%B8%BB%E6%AA%94&message=COM-T016T%20ALTIS%20%2003-07%20%E5%A3%93%E7%B8%AE%E6%A9%9F%201.6%201.8%20(10S15L)%206PK%20145mm%20%E6%8F%92%E9%A0%AD%E5%9C%93%20%E7%84%A1%E4%B8%8A%E8%93%8B%20%E6%96%B0%E5%93%81&TYPE_LABLE=ALTIS&CHNAME_LABLE=%E5%A3%93%E7%B8%AE%E6%A9%9F';
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
  fs.writeFileSync(path.join(__dirname, 'media_frame_full.html'), html);
  console.log("已儲存 iframe HTML");
  
  const imgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => img.src);
  });
  console.log("Iframe 內的圖片:", imgs);

  await browser.close();
})();
