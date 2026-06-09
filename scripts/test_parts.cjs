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
  await page.goto('http://cck.uparts.info/car2009/parts_query/', {waitUntil: 'domcontentloaded'});
  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, 'parts_query.html'), html);
  console.log('Saved parts_query.html');
  await browser.close();
})();
