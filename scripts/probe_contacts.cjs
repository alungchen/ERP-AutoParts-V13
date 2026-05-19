const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('啟動 Puppeteer 進行探測...');
  const browser = await puppeteer.launch({
    headless: "new",
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
  }

  // --- 探測 Supplier ---
  console.log('前往廠商查詢頁面...');
  await page.goto('http://cck.uparts.info/car2009/supplier_query/', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // 嘗試點擊查詢按鈕
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('input[type="button"], button'));
    const searchBtn = btns.find(b => b.value === '查詢' || b.innerText.includes('查詢'));
    if (searchBtn) searchBtn.click();
  });
  await sleep(3000);

  const supplierListHtml = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'supplier_list_dump.html'), supplierListHtml);
  console.log('已儲存 supplier_list_dump.html');

  // 找第一個 checkbox 值作為 ID
  const supplierId = await page.evaluate(() => {
    const cb = document.querySelector('input[type="checkbox"][value]:not([value="on"])');
    // 有時候舊系統 ID 在 tr 的屬性或是按鈕的 onclick 中
    if (cb && cb.value) return cb.value;
    
    // 如果找不到 checkbox，找看看修改按鈕的 onclick
    const editBtn = Array.from(document.querySelectorAll('input[type="button"]')).find(b => b.value === '修改');
    if (editBtn && editBtn.getAttribute('onclick')) {
        const match = editBtn.getAttribute('onclick').match(/id=([^&'"]+)/i);
        if (match) return match[1];
    }
    
    // 或者任何帶有 GUID 的 href
    const link = document.querySelector('a[href*="id="]');
    if (link) {
        const match = link.href.match(/id=([^&]+)/i);
        if (match) return match[1];
    }
    return null;
  });

  if (supplierId) {
    console.log(`找到廠商 ID: ${supplierId}，前往編輯頁面...`);
    await page.goto(`http://cck.uparts.info/CAR2009/Supplier_Query_Edit/?id=${supplierId}`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const supplierEditHtml = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'supplier_edit_dump.html'), supplierEditHtml);
    console.log('已儲存 supplier_edit_dump.html');
  } else {
    console.log('找不到廠商 ID。');
  }

  // --- 探測 Customer ---
  console.log('前往客戶查詢頁面...');
  await page.goto('http://cck.uparts.info/car2009/customer_query/', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('input[type="button"], button'));
    const searchBtn = btns.find(b => b.value === '查詢' || b.innerText.includes('查詢'));
    if (searchBtn) searchBtn.click();
  });
  await sleep(3000);

  const customerListHtml = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'customer_list_dump.html'), customerListHtml);
  console.log('已儲存 customer_list_dump.html');

  const customerId = await page.evaluate(() => {
    const cb = document.querySelector('input[type="checkbox"][value]:not([value="on"])');
    if (cb && cb.value) return cb.value;
    
    const editBtn = Array.from(document.querySelectorAll('input[type="button"]')).find(b => b.value === '修改');
    if (editBtn && editBtn.getAttribute('onclick')) {
        const match = editBtn.getAttribute('onclick').match(/id=([^&'"]+)/i);
        if (match) return match[1];
    }
    
    const link = document.querySelector('a[href*="id="]');
    if (link) {
        const match = link.href.match(/id=([^&]+)/i);
        if (match) return match[1];
    }
    return null;
  });

  if (customerId) {
    console.log(`找到客戶 ID: ${customerId}，前往編輯頁面...`);
    await page.goto(`http://cck.uparts.info/CAR2009/Customer_Query_Edit/?id=${customerId}`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    const customerEditHtml = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'customer_edit_dump.html'), customerEditHtml);
    console.log('已儲存 customer_edit_dump.html');
  } else {
    console.log('找不到客戶 ID。');
  }

  await browser.close();
  console.log('探測完成。');
})();
