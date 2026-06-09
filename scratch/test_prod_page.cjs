const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
    page.on('response', async response => {
        if (response.url().includes('/api/documents')) {
            console.log('API RESPONSE STATUS:', response.status());
            try {
                const text = await response.text();
                console.log('API RESPONSE TEXT:', text.substring(0, 200) + '...');
            } catch (e) {
                console.log('API RESPONSE TEXT ERROR:', e.message);
            }
        }
    });

    await page.goto('https://erp-autoparts-v13.pages.dev/documents?tab=sales', { waitUntil: 'networkidle0' });
    await browser.close();
})();
