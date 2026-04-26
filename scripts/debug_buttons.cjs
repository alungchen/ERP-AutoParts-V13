/**
 * debug_buttons.cjs - 找出適用大視窗的按鈕 ID
 * node scripts/debug_buttons.cjs
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
      '--disable-features=UpgradeInsecureRequests',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--disable-popup-blocking',
    ]
  });

  const page = await browser.newPage();

  // Load cookies
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...cookies);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
  }

  // Search com-b021
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]'))
      .find(i => (i.id||'').startsWith('ele_search_'));
    if (inp) { inp.value = 'com-b021'; inp.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  await sleep(300);
  await page.evaluate(() => { document.querySelector('#btn_search')?.click(); });
  await sleep(3000);

  // List ALL buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="button"], button, a[onclick]'))
      .map(b => ({
        tag: b.tagName,
        id: b.id,
        value: (b.value || b.textContent || '').trim().substring(0, 20),
        onclick: (b.getAttribute('onclick') || b.onclick?.toString() || '').substring(0, 80)
      }))
      .filter(b => b.id || b.value)
      .slice(0, 60);
  });

  console.log('\n=== ALL BUTTONS ===');
  buttons.forEach(b => console.log(`  [${b.tag}] id="${b.id}" value="${b.value}" onclick="${b.onclick}"`));

  // Find keydown handler
  console.log('\n=== KEYBOARD HANDLERS ===');
  const keyHandler = await page.evaluate(() => {
    const bodyOnKey = document.body.getAttribute('onkeydown') || '';
    const docOnKey = document.onkeydown?.toString() || '';
    const winOnKey = window.onkeydown?.toString() || '';
    return { bodyOnKey: bodyOnKey.substring(0,300), docOnKey: docOnKey.substring(0,300), winOnKey: winOnKey.substring(0,300) };
  });
  console.log('  body.onkeydown:', keyHandler.bodyOnKey);
  console.log('  document.onkeydown:', keyHandler.docOnKey);
  console.log('  window.onkeydown:', keyHandler.winOnKey);

  // Click the first data row (COM-B021)
  console.log('\n=== CLICKING COM-B021 ROW ===');
  await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('tr'));
    const target = trs.find(tr =>
      Array.from(tr.querySelectorAll('td')).some(td => td.innerText.trim() === 'COM-B021')
    );
    if (target) { target.click(); console.log('Row clicked'); }
  });
  await sleep(1500);

  // Try ALT+V in page context (simulate keyboard event)
  console.log('\n=== SIMULATING ALT+V ===');

  const popupPromise = new Promise(resolve => {
    browser.once('targetcreated', async target => {
      try { resolve(await target.page()); } catch { resolve(null); }
    });
  });

  await page.bringToFront();
  await sleep(300);

  // Try direct keyboard event dispatch in page
  await page.evaluate(() => {
    ['keydown', 'keypress', 'keyup'].forEach(type => {
      const e = new KeyboardEvent(type, {
        key: 'v', keyCode: 86, altKey: true, bubbles: true, cancelable: true
      });
      document.dispatchEvent(e);
      document.body.dispatchEvent(e);
    });
  });

  const popupFromEval = await Promise.race([popupPromise, sleep(3000).then(() => null)]);
  if (popupFromEval) {
    console.log('  POPUP DETECTED (via evaluate dispatch)!');
    const popupUrl = await popupFromEval.url().catch(() => 'unknown');
    console.log('  Popup URL:', popupUrl);
    await popupFromEval.close();
  } else {
    // Try Puppeteer keyboard API
    const popupPromise2 = new Promise(resolve => {
      browser.once('targetcreated', async target => {
        try { resolve(await target.page()); } catch { resolve(null); }
      });
    });
    await page.keyboard.down('Alt');
    await page.keyboard.press('v');
    await page.keyboard.up('Alt');

    const popupFromKey = await Promise.race([popupPromise2, sleep(5000).then(() => null)]);
    if (popupFromKey) {
      console.log('  POPUP DETECTED (via Puppeteer keyboard)!');
      const popupUrl = await popupFromKey.url().catch(() => 'unknown');
      console.log('  Popup URL:', popupUrl);
      await popupFromKey.close();
    } else {
      console.log('  No popup detected with either method');
    }
  }

  // Check for "適用-大" or similar button
  console.log('\n=== LOOKING FOR 適用 BIG BUTTON ===');
  const applyBigBtn = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input[type="button"], button, a'));
    const found = all.filter(b => (b.value || b.textContent || b.title || '').includes('大') ||
                                  (b.value || b.textContent || b.title || '').includes('全') ||
                                  (b.id || '').toLowerCase().includes('big') ||
                                  (b.id || '').toLowerCase().includes('all'));
    return found.map(b => ({ id: b.id, val: (b.value||b.textContent||'').trim().substring(0,20), onclick: (b.getAttribute('onclick')||'').substring(0,80) }));
  });
  console.log('  Possible large-view buttons:', JSON.stringify(applyBigBtn, null, 2));

  console.log('\nLeaving browser open for 30s for manual inspection...');
  await sleep(30000);
  await browser.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
