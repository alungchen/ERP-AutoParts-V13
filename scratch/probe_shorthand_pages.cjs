/** 探測 cck2 片語資料選單連結與頁面結構（只讀取） */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'cck2.uparts.info';

(async () => {
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'cookies_xizhi.json'), 'utf8'))
    .map(c => ({ ...c, domain: HOST }));

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.on('dialog', async d => { console.log('對話框:', d.message()); await d.accept().catch(() => {}); });

  await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.setCookie(...saved);
  await page.goto(`http://${HOST}/car2009/Default/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  // 1. 選單中含「片語」的連結
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .filter(a => (a.innerText || '').includes('片語'))
      .map(a => ({ text: a.innerText.trim(), href: a.href, onclick: a.getAttribute('onclick') || '' }));
  });
  console.log('含「片語」的選單連結:');
  console.log(JSON.stringify(links, null, 2));

  // 2. 檢查車型片語頁 Type_Query2 的結構
  await page.goto(`http://${HOST}/car2009/Type_Query2/`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const structure = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('input[type=button], input[type=submit], button'))
      .map(b => ({ tag: b.tagName, id: b.id || '', value: b.value || b.innerText || '' }));
    const inputs = Array.from(document.querySelectorAll('input[type=text], input:not([type])'))
      .map(i => ({ id: i.id || '', name: i.name || '', value: i.value || '' }));
    const selects = Array.from(document.querySelectorAll('select')).map(s => ({
      id: s.id || '', options: Array.from(s.options).map(o => o.text)
    }));
    return { url: location.href, btns, inputs: inputs.slice(0, 20), selects };
  });
  console.log('\nType_Query2 頁面結構:');
  console.log(JSON.stringify(structure, null, 2));

  await browser.close();
})();
