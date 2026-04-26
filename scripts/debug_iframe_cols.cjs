const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false, userDataDir: './.chrome-profile' });
  const page = await browser.newPage();
  try {
    await page.goto('http://cck2.uparts.info/car2009/parts_query/', { waitUntil: 'domcontentloaded' });
  } catch (err) {
    console.log('goto error:', err.message);
  }
  
  // wait for manual login or use cookies
  await page.waitForTimeout(3000);
  
  // Search for COM-B048
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('input[type="text"]')).find(i => (i.id || '').startsWith('ele_search_'));
    if (inp) { inp.value = 'COM-B048'; inp.dispatchEvent(new Event('change', {bubbles:true})); }
    document.querySelector('#btn_search')?.click();
  });
  
  await page.waitForTimeout(3000);
  
  // Click row 1
  await page.evaluate(() => {
    if (typeof open_dialog_partkey === 'function') open_dialog_partkey(1);
  });
  
  await page.waitForTimeout(3000);
  
  const frame = page.frames().find(f => f.url().includes('product_info_partkey_big'));
  if (frame) {
    const data = await frame.evaluate(() => {
      const bestTable = Array.from(document.querySelectorAll('table')).sort((a,b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0];
      return Array.from(bestTable.querySelectorAll('tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td,th')).map(el => {
          const inp = el.querySelector('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=hidden])');
          return (inp ? inp.value : el.innerText).trim().replace(/\s+/g,' ');
        });
      });
    });
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('No frame found');
  }
  
  await browser.close();
})();
