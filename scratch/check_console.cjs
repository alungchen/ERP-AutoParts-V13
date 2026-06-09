const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('PAGE CONSOLE ERROR:', msg.text());
        } else {
            console.log('PAGE CONSOLE LOG:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('PAGE RUNTIME ERROR:', err.toString());
    });

    console.log('Navigating to http://localhost:5173...');
    try {
        await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 10000 });
        // 等候 2 秒讓 React 初始渲染
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Clicking search button...');
        const buttons = await page.$$('button');
        let searchBtn;
        for (const btn of buttons) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text.includes('搜尋')) {
                searchBtn = btn;
                break;
            }
        }
        
        if (searchBtn) {
            await searchBtn.click();
            console.log('Search button clicked. Waiting for data load & render...');
            // 等候 5 秒讓資料載入與渲染
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            console.warn('Could not find search button!');
        }

        console.log('Checking page content...');
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log('Page body text snippet length:', bodyText.length);
        console.log('Page body text snippet:', bodyText.slice(0, 800));
    } catch (err) {
        console.error('Navigation or interaction failed:', err.message);
    }

    await browser.close();
    console.log('Browser closed.');
})();
