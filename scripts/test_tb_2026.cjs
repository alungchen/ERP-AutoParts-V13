const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const PROFILE_DIR = path.join(__dirname, '.chrome-profile-docs');
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const cookiesPath = path.join(__dirname, 'cookies.json');
  if (fs.existsSync(cookiesPath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies);
    console.log("Cookies loaded.");
  }
  
  console.log("Navigating to tb page...");
  await page.goto('http://cck.uparts.info/car2009/tb/', { waitUntil: 'networkidle2' });
  
  console.log("Searching for 2026-05-18...");
  await page.evaluate(() => {
    document.querySelector('#ele_單號').value = '';
    const queryMaster = document.querySelector('#ele_QueryMaster');
    if (queryMaster) {
      queryMaster.value = '2026-05-18';
      queryMaster.focus();
    }
    const btn = document.querySelector('#btn_QueryMaster');
    if (btn) btn.click();
  });
  
  // Wait for 5 seconds for results to load
  await new Promise(r => setTimeout(r, 5000));
  
  const docInfo = await page.evaluate(() => {
    const getValue = (sel) => document.querySelector(sel)?.value || document.querySelector(sel)?.innerText || '';
    return {
      docNo: getValue('#ele_單號'),
      docDate: getValue('#ele_交易日期'),
      customer: getValue('#ele_對象名稱'),
      total: getValue('#ele_總額') || getValue('#ele_外幣總額'),
      note: getValue('#ele_備註'),
      dialog: document.querySelector('#dialog-message-p')?.innerText || ''
    };
  });
  
  console.log("Current document info on tb page:", docInfo);
  
  const screenshotPath = path.join(__dirname, '..', 'output', 'test_tb.png');
  await page.screenshot({ path: screenshotPath });
  console.log("Screenshot saved to:", screenshotPath);
  
  await browser.close();
})();
