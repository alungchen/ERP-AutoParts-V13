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
  const urls = [];

  // 監聽網路請求
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('Media') || url.includes('Upload') || url.includes('img') || url.includes('photo') || url.includes('jpg') || url.includes('png')) {
      urls.push(url);
    }
  });

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

  urls.length = 0; // 清空前面的資源
  
  console.log("點擊圖片按鈕...");
  await page.evaluate(() => {
    const btn = document.querySelector('input[value="圖片"]');
    if (btn) btn.click();
  });

  await sleep(5000);
  
  // 印出 iframe 或 dialog 中的圖片
  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => img.src);
  });
  
  let frameImgs = [];
  for (const frame of page.frames()) {
    try {
        const frameImages = await frame.evaluate(() => Array.from(document.querySelectorAll('img')).map(img => img.src));
        if (frameImages.length > 0) {
            frameImgs = frameImgs.concat(frameImages);
        }
    } catch (e) {}
  }

  fs.writeFileSync(path.join(__dirname, 'photo_urls.json'), JSON.stringify({ urls, imgs, frameImgs }, null, 2));
  console.log("已儲存至 photo_urls.json");

  await browser.close();
})();
