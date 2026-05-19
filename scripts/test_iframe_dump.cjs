const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    userDataDir: path.join(__dirname, '.chrome-profile'),
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto('http://cck.uparts.info/car2009/Default/', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Search
    await page.evaluate(() => {
      const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.id||'').startsWith('ele_search_'));
      if(inp) { inp.value = 'COM-T001T'; inp.dispatchEvent(new Event('change',{bubbles:true})); }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.querySelector('#btn_search')?.click());
    await new Promise(r => setTimeout(r, 3000));
    
    // Click row and btn
    await page.evaluate(() => {
      const tr = document.querySelector('tr[row="1"]') || document.querySelector('tr[row="0"]');
      if (tr) {
          tr.click();
          const btn = document.querySelector('#btn_partkey');
          if (btn) btn.click();
      }
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    const frame = page.frames().find(f => f.url().includes('product_info_partkey_big'));
    if (frame) {
        console.log('Found frame:', frame.url());
        const html = await frame.evaluate(() => document.body.innerHTML);
        fs.writeFileSync(path.join(__dirname, 'iframe_dump.html'), html);
        console.log('Dumped iframe HTML to scripts/iframe_dump.html');
        
        const tables = await frame.evaluate(() => {
            return Array.from(document.querySelectorAll('table')).map((t, i) => {
                return {
                    index: i,
                    text: t.innerText.substring(0, 100).replace(/\n/g, ' '),
                    rows: t.rows.length,
                    firstRowCells: t.rows.length > 0 ? t.rows[0].cells.length : 0
                };
            });
        });
        console.log('Tables found in iframe:', tables);
    } else {
        console.log('Frame not found!');
    }
  } catch(e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
