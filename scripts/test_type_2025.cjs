const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({headless: true, executablePath});
  const page = await browser.newPage();
  const cookiesPath = path.join(__dirname, 'cookies.json');
  if(fs.existsSync(cookiesPath)){
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    await page.setCookie(...cookies);
  }
  await page.goto('http://cck.uparts.info/car2009/ts/', {waitUntil: 'networkidle2'});
  
  await page.evaluate(() => { document.querySelector('#ele_單號').value = ''; });
  
  // Type it out
  await page.focus('#ele_QueryMaster');
  await page.keyboard.type('2025-05-15');
  await page.keyboard.press('Enter');
  
  // Or click the button
  await page.click('#btn_QueryMaster');
  
  // wait 5 seconds
  await new Promise(r => setTimeout(r, 5000));
  
  const docNo = await page.evaluate(() => document.querySelector('#ele_單號').value);
  console.log("docNo for 2025-05-15 after TYPING:", docNo);
  
  await browser.close();
})();
