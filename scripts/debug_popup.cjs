/**
 * debug_popup.cjs - 分析 btn_partkey 完整行為
 * node scripts/debug_popup.cjs
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_URL     = 'http://cck2.uparts.info/car2009/parts_query/';
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR  = path.join(__dirname, '.chrome-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--disable-popup-blocking',
    ]
  });

  // 監控所有新 target
  browser.on('targetcreated', async target => {
    console.log(`\n🎯 NEW TARGET: type=${target.type()}, url=${target.url()}`);
    const pg = await target.page().catch(() => null);
    if (pg) {
      await sleep(2000);
      const url = await pg.url();
      const title = await pg.title();
      console.log(`   Page: url=${url}, title=${title}`);
      const tables = await pg.evaluate(() => document.querySelectorAll('table').length).catch(() => 0);
      console.log(`   Tables in popup: ${tables}`);
      // 讀取彈出視窗的資料
      const rows = await pg.evaluate(() => {
        const res = [];
        for (const tr of document.querySelectorAll('tr')) {
          const cells = Array.from(tr.querySelectorAll('td,th')).map(td => {
            const inp = td.querySelector('input:not([type=button]):not([type=submit])');
            return (inp ? inp.value : td.innerText).trim().substring(0,30);
          }).filter(v => v);
          if (cells.length >= 3) res.push(cells);
        }
        return res.slice(0, 10);
      }).catch(() => []);
      if (rows.length) {
        console.log('   Popup rows (first 10):');
        rows.forEach((r, i) => console.log(`     [${i}]`, JSON.stringify(r)));
      }
    }
  });

  const page = await browser.newPage();

  // Cookie login
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...cookies);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
  }

  // Search
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]'))
      .find(i => (i.id||'').startsWith('ele_search_'));
    if (inp) { inp.value = 'com-b021'; inp.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  await sleep(300);
  await page.evaluate(() => document.querySelector('#btn_search')?.click());
  await sleep(3000);

  // 1. Get FULL onclick of btn_partkey
  const fullOnclick = await page.evaluate(() => {
    const btn = document.querySelector('#btn_partkey');
    return btn ? (btn.getAttribute('onclick') || btn.onclick?.toString()) : 'not found';
  });
  console.log('\n=== btn_partkey FULL onclick ===');
  console.log(fullOnclick);

  // 2. Get ui-state-active status BEFORE click
  const beforeActive = await page.evaluate(() =>
    $j('#display_DataGrid tbody .ui-state-active').length
  );
  console.log(`\n=== ui-state-active rows BEFORE click: ${beforeActive} ===`);

  // 3. Click first data row using jQuery
  const rowFound = await page.evaluate(() => {
    let found = false;
    $j('#display_DataGrid tbody tr').first().click();
    found = true;
    return found;
  });
  console.log(`\n=== Clicked first row: ${rowFound} ===`);
  await sleep(1500);

  // 4. Check ui-state-active AFTER click
  const afterActive = await page.evaluate(() => {
    const active = $j('#display_DataGrid tbody .ui-state-active');
    return {
      count: active.length,
      html: active.length > 0 ? active[0].innerHTML.substring(0, 200) : 'none'
    };
  });
  console.log(`\n=== ui-state-active AFTER click: ${afterActive.count} ===`);
  if (afterActive.count > 0) console.log('   HTML:', afterActive.html);

  // 5. Try clicking btn_partkey and see what happens
  console.log('\n=== Clicking btn_partkey ===');
  const btnExists = await page.evaluate(() => !!document.querySelector('#btn_partkey'));
  console.log('   btn_partkey exists:', btnExists);

  await page.evaluate(() => document.querySelector('#btn_partkey')?.click());
  console.log('   Clicked! Waiting 10s for popup...');

  await sleep(10000);

  // 6. Check if a dialog appeared (iframe overlay)
  const dialogInfo = await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], .ui-dialog, .dialog, iframe');
    return Array.from(dialogs).map(d => ({
      tag: d.tagName,
      id: d.id,
      visible: window.getComputedStyle(d).display !== 'none',
      src: d.src || '',
    }));
  });
  console.log('\n=== Dialogs/iframes after btn_partkey click ===');
  dialogInfo.forEach(d => console.log(' ', JSON.stringify(d)));

  // 7. Check all pages
  const allPages = await browser.pages();
  console.log(`\n=== Total browser pages: ${allPages.length} ===`);
  for (const pg of allPages) {
    console.log(`   Page: url=${await pg.url()}, title=${await pg.title()}`);
  }

  console.log('\nLeaving open 30s for manual inspection...');
  await sleep(30000);
  await browser.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
