const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGIN_URL = 'http://cck2.uparts.info/car2009/parts_query/';
const TARGET_URL = 'http://cck2.uparts.info/car2009/ts/';

(async () => {
  const PROFILE_DIR = path.join(__dirname, '.chrome-profile-docs');
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    headless: true, // 使用無頭模式快速抓取
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const searchInput = document.querySelector('#ele_QueryMaster');
    if (searchInput) {
      searchInput.value = '2026-05-08';
      searchInput.focus();
    }
    document.querySelector('#btn_QueryMaster')?.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
  const detailHtml = await page.evaluate(() => {
     const table = document.querySelector('#display_DataGridDetail table') || document.querySelector('#DataGridDetail');
     return table ? table.outerHTML : 'Table not found';
  });

  fs.writeFileSync(path.join(__dirname, '..', 'output', 'detail_table.html'), detailHtml, 'utf8');
  console.log('✅ 已經抓取 detail_table.html');
  await browser.close();
})();
