const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    const PROFILE_DIR = path.join(__dirname, '..', 'scripts', '.chrome-profile-docs');
    const COOKIES_FILE = path.join(__dirname, '..', 'scripts', 'cookies.json');
    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-popup-blocking']
    });
    const page = await browser.newPage();
    if (fs.existsSync(COOKIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        await page.setCookie(...saved);
    }
    await page.goto('http://cck.uparts.info/car2009/ts/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 3000));
    
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync(path.join(__dirname, 'ts_html.txt'), html);
    
    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, button')).map(el => {
            return {
                tag: el.tagName,
                id: el.id,
                name: el.name,
                type: el.type,
                value: el.value,
                className: el.className
            };
        });
    });
    console.log(inputs);
    await browser.close();
})();
