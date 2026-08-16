const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const COOKIES_FILE = path.join(__dirname, 'cookies_songshan.json');
const LOGIN_URL = 'http://cck.uparts.info/car2009/Default/';

(async () => {
  console.log('正在尋找系統內建的 Google Chrome...');
  
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  if (executablePath) {
    console.log(`✓ 找到 Chrome: ${executablePath}`);
  } else {
    console.log('ℹ 找不到系統內建 Chrome，將使用 Puppeteer 預設瀏覽器。');
  }

  console.log('正在啟動 Chrome 瀏覽器並加載松山店憑證...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    ...(executablePath ? { executablePath } : {}),
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  if (fs.existsSync(COOKIES_FILE)) {
    const savedCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    // 確保 domain 改為 cck.uparts.info 才能正確登入松山店
    const songshanCookies = savedCookies.map(cookie => ({
      ...cookie,
      domain: 'cck.uparts.info'
    }));
    await page.setCookie(...songshanCookies);
    console.log('✅ 已成功注入松山店 (admin) 的憑證 Cookie。');
  } else {
    console.log('⚠️ 找不到 cookies_songshan.json 檔案。');
  }

  console.log(`正在導向松山店登入網址: ${LOGIN_URL}`);
  try {
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    console.log('🎉 瀏覽器已開啟並自動登入，您可以開始使用了！');
    console.log('💡 請勿關閉終端機，否則瀏覽器會隨之關閉。');
  } catch (err) {
    console.error('❌ 導向網頁失敗:', err.message);
  }
})();
