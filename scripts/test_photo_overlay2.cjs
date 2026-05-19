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
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

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
    }
  });

  await sleep(5000);
  
  await page.screenshot({ path: path.join(__dirname, 'overlay_screenshot2.png') });
  
  const iframeHtml = await page.evaluate(() => {
      const fr = document.querySelector('#Iframe_MEDIA_List');
      return fr ? fr.outerHTML : 'no iframe';
  });
  console.log("Iframe tag:", iframeHtml);
  
  let frameHtml = '';
  const frames = page.frames();
  const mediaFrame = frames.find(f => f.url().includes('Iframe_MEDIA_List'));
  if (mediaFrame) {
      frameHtml = await mediaFrame.evaluate(() => document.documentElement.outerHTML);
      fs.writeFileSync(path.join(__dirname, 'media_frame_content.html'), frameHtml);
      console.log("已儲存 iframe 的 HTML 至 media_frame_content.html");
      
      const imgs = await mediaFrame.evaluate(() => {
          return Array.from(document.querySelectorAll('img')).map(img => img.src);
      });
      console.log("Iframe 內的圖片:", imgs);
  } else {
      console.log("找不到對應的 frame");
  }

  await browser.close();
})();
