const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    if (fs.existsSync(COOKIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        await page.setCookie(...saved);
    }

    console.log(`Navigating to parts_query to init session`);
    await page.goto('http://cck2.uparts.info/car2009/parts_query/', { waitUntil: 'domcontentloaded' });

    const url = `http://cck2.uparts.info/car2009/Iframe_MEDIA_List/?KeyValue=72CC4E1D-8673-4107-81D2-D1F6D091B6DE&TableName=%E9%9B%B6%E4%BB%B6%E4%B8%BB%E6%AA%94&message=&TYPE_LABLE=&CHNAME_LABLE=`;
    
    console.log(`Navigating to ${url}`);
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        const imageUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img')).map(img => img.src);
        });
        
        console.log("Found images:", imageUrls);
        const rawHtml = await page.evaluate(() => document.body.innerHTML);
        console.log("Raw HTML length:", rawHtml.length);
        if(rawHtml.length < 2000) console.log(rawHtml);
    } catch (err) {
        console.log("Error:", err);
    }
    
    await browser.close();
})();
