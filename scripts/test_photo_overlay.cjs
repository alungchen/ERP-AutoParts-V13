const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://cck.uparts.info/car2009/Default/';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // 顯示視窗以便觀察
    defaultViewport: { width: 1440, height: 900 },
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
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
    await sleep(20000); 
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
  }

  console.log("搜尋 COM-T016T ...");
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.focus(); inp.value = 'COM-T016T'; inp.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  await sleep(500);
  await page.evaluate(() => document.querySelector('#btn_search')?.click());
  await sleep(3000);

  console.log("點擊圖片按鈕...");
  await page.evaluate(() => {
    const btn = document.querySelector('input[value="圖片"]');
    if (btn) btn.click();
  });

  await sleep(5000); // 等待 overlay 開啟及載入
  
  // 截圖
  await page.screenshot({ path: path.join(__dirname, 'overlay_screenshot.png') });
  
  // 找尋 iframe
  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('#Iframe_MEDIA_List');
    return iframe ? iframe.src : null;
  });
  
  console.log("Iframe Src:", iframeSrc);
  
  let frameHtml = '';
  if (iframeSrc) {
    const frames = page.frames();
    const mediaFrame = frames.find(f => f.url().includes('Iframe_MEDIA_List'));
    if (mediaFrame) {
        frameHtml = await mediaFrame.evaluate(() => document.documentElement.outerHTML);
        fs.writeFileSync(path.join(__dirname, 'media_frame_content.html'), frameHtml);
        console.log("已儲存 iframe 的 HTML 至 media_frame_content.html");
        
        // 取得裡面的圖片
        const imgs = await mediaFrame.evaluate(() => {
            return Array.from(document.querySelectorAll('img')).map(img => img.src);
        });
        console.log("Iframe 內的圖片:", imgs);
    } else {
        console.log("找不到對應的 frame");
    }
  }

  await browser.close();
})();
