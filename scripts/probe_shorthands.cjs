const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    if (fs.existsSync(COOKIES_FILE)) {
        await page.setCookie(...JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8')));
    }

    console.log('前往首頁...');
    await page.goto('http://cck.uparts.info/car2009/Type_Query2/', { waitUntil: 'domcontentloaded' }); // 車型片語
    await sleep(2000);

    // 嘗試輸入空查詢
    console.log('嘗試輸入 % 查詢...');
    await page.evaluate(() => {
        const inp = document.querySelector('input[type="text"]');
        if (inp) {
            inp.value = '%';
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btn = Array.from(document.querySelectorAll('input[type="button"], button')).find(b => b.value === '查詢' || b.innerText === '查詢');
        if (btn) btn.click();
    });

    await sleep(3000);

    // 抓取結果
    const rows = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        }).filter(cols => cols.length >= 3);
    });

    console.log(`查詢 '%' 找到 ${rows.length} 列資料`);
    if (rows.length > 0) console.log(rows.slice(0, 3));

    console.log('嘗試空查詢...');
    await page.evaluate(() => {
        const inp = document.querySelector('input[type="text"]');
        if (inp) {
            inp.value = '';
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const btn = Array.from(document.querySelectorAll('input[type="button"], button')).find(b => b.value === '查詢' || b.innerText === '查詢');
        if (btn) btn.click();
    });
    await sleep(3000);
    const rows2 = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('tr')).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        }).filter(cols => cols.length >= 3);
    });
    console.log(`空查詢找到 ${rows2.length} 列資料`);
    if (rows2.length > 0) console.log(rows2.slice(0, 3));

    await browser.close();
})();
