const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const LOGIN_URL = 'http://cck2.uparts.info/car2009/parts_query/'; // 登入專用網址
const DOC_URLS = {
  quotation: 'http://cck2.uparts.info/car2009/tq/',
  sales: 'http://cck2.uparts.info/car2009/ts/',
  salesReturn: 'http://cck2.uparts.info/car2009/tt/',
  inquiry: 'http://cck2.uparts.info/car2009/tii/',
  purchase: 'http://cck2.uparts.info/car2009/tip/',
  purchaseReturn: 'http://cck2.uparts.info/car2009/tr/',
};

// 參數解析
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];

if (!typeArg || !startArg || !endArg) {
  console.log(`
使用方式: node scripts/scrape_documents.cjs --type=<單據類型> --start=<開始日期> --end=<結束日期>
單據類型支援: quotation (報價), sales (銷貨), salesReturn (銷退), inquiry (詢價), purchase (進貨), purchaseReturn (進退)
範例: node scripts/scrape_documents.cjs --type=sales --start=2023-01-01 --end=2023-01-31
`);
  process.exit(1);
}

if (!DOC_URLS[typeArg]) {
  console.log('未知的單據類型。');
  process.exit(1);
}

const targetUrl = DOC_URLS[typeArg];
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const PROFILE_DIR = path.join(__dirname, '.chrome-profile-docs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ensurePageReady(page) {
  const isError = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return t.includes('502 Bad Gateway') || t.includes('Server Error') || t.includes('could not complete your request');
  });
  if (isError) throw new Error('目標網站發生 502 Server Error 或崩潰！請稍後再試。');
}

function escapeCSV(val) {
  const s = String(val ?? '').trim();
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function writeCSV(filePath, headers, rows) {
  const lines = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))];
  fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log(`  ✓ ${rows.length} rows → ${path.basename(filePath)}`);
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  console.log('啟動爬蟲瀏覽器...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1440, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-popup-blocking']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);
  
  // 1. 登入檢查
  console.log('\n[1] 檢查登入狀態...');
  try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
  await ensurePageReady(page);
  await sleep(2000);

  if (fs.existsSync(COOKIES_FILE)) {
    const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    await page.setCookie(...saved);
    try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(2000);
  }
  
  const needLogin = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
           !document.querySelector('#btn_search');
  });

  if (needLogin) {
    await page.evaluate(() => {
      document.title = '🔴 請在此視窗登入！';
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f00;color:#fff;text-align:center;font-size:22px;font-weight:bold;padding:12px;';
      b.textContent = '⚠️ 爬蟲視窗：請在此登入！';
      document.body.prepend(b);
    }).catch(() => {});
    
    console.log('⚠️ 請在開啟的 Chrome 視窗手動登入！登入完成後程式會自動繼續...');
    for (let i = 0; i < 120; i++) {
      await sleep(3000);
      const isStillLogin = await page.evaluate(() => Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') && !document.querySelector('#btn_search'));
      if (!isStillLogin) break;
    }
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
    console.log('✅ 登入成功，儲存登入狀態。');
    
    try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(2000);
  } else {
    console.log('✅ 已經登入。');
  }

  // 2. 前往目標單據頁面
  console.log(`\n[2] 前往 ${typeArg} 單據頁面: ${targetUrl}`);
  try { await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }); } catch {}
  await ensurePageReady(page);
  await sleep(2000);

  function getDatesInRange(startStr, endStr) {
    const dates = [];
    let current = new Date(endStr);
    const start = new Date(startStr);
    while (current >= start) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() - 1); // 往前推一天
    }
    return dates;
  }

  const dateList = getDatesInRange(startArg, endArg);
  console.log(`\n[3] 準備逐日爬取，從 ${endArg} 爬到 ${startArg} (共 ${dateList.length} 天)...`);

  const allMasterRows = [];
  const allDetailRows = [];
  let processedDocNos = new Set();

  for (const targetDate of dateList) {
      console.log(`\n▶ 開始查詢日期: ${targetDate}`);
      
      await page.evaluate((d) => {
        const docNoInput = document.querySelector('#ele_單號');
        if (docNoInput) docNoInput.value = ''; // 清空單號以利判斷是否載入成功
        const searchInput = document.querySelector('#ele_QueryMaster');
        if (searchInput) {
          searchInput.value = d;
          searchInput.focus();
        }
        document.querySelector('#btn_QueryMaster')?.click();
      }, targetDate);

      // 等待資料載入 (等待單號有值，或3秒逾時代表當天沒單)
      let hasData = true;
      try {
        await page.waitForFunction(() => {
            return document.querySelector('#ele_單號')?.value !== '';
        }, { timeout: 3000 });
      } catch (e) {
        console.log(`  (查無單據或載入逾時，跳過 ${targetDate})`);
        hasData = false;
      }
      
      await sleep(1000); // 給予明細表 AJAX 載入時間

      if (!hasData) continue;

      // 當天有資料，開始「上一筆」迴圈
      while (true) {
        const docData = await page.evaluate(() => {
            const getValue = (selector) => {
                const el = document.querySelector(selector);
                return el ? (el.value || el.innerText || '').trim() : '';
            };
            
            const docNo = getValue('#ele_單號');
            const docDate = getValue('#ele_交易日期');
            const customer = getValue('#ele_對象名稱');
            const total = getValue('#ele_總額') || getValue('#ele_外幣總額');
            const note = getValue('#ele_備註');
            
            // 抓表明細
            const grid = document.querySelector('#display_DataGridDetail table') || document.querySelector('#DataGridDetail');
            let items = [];
            if (grid) {
                const trs = grid.querySelectorAll('tbody tr');
                trs.forEach(tr => {
                    const getValueByField = (field) => {
                        const el = tr.querySelector(`input[fieldname="${field}"]`);
                        return el ? el.value.trim() : '0';
                    };
                    
                    const partNo = getValueByField('零件號碼');
                    if (partNo) {
                        items.push({
                            partNo: partNo,
                            qty: getValueByField('數量') || '1',
                            price: getValueByField('單價') || '0',
                            subtotal: getValueByField('小計') || '0'
                        });
                    }
                });
            }
            
            return { docNo, docDate, customer, total, note, items };
        });

        if (!docData.docNo) break;

        if (processedDocNos.has(docData.docNo)) {
            // 已經抓過的單號，代表這一天的「上一筆」已經繞回最新一筆了，或者重複
            console.log(`  ⚠️ 已經抓過 ${docData.docNo}，本日前翻結束。`);
            break;
        }
        processedDocNos.add(docData.docNo);

        console.log(`  📝 擷取: ${docData.docDate} | ${docData.docNo} | ${docData.customer} | 明細 ${docData.items.length} 筆`);
        
        allMasterRows.push([
            docData.docNo,
            typeArg, 
            docData.docDate,
            docData.customer,
            docData.total,
            docData.note
        ]);

        docData.items.forEach((item) => {
            const cleanNum = (str) => String(str).replace(/,/g, '').trim() || '0';
            allDetailRows.push([
                docData.docNo,
                item.partNo,                        // PartNo
                cleanNum(item.qty),                 // Qty
                cleanNum(item.price),               // Unit Price
                cleanNum(item.subtotal)             // Subtotal
            ]);
        });

        // 點擊「上一筆」
        const prevDocNo = docData.docNo;
        await page.evaluate(() => {
            const btn = document.querySelector('#btn_UpRecord');
            if (btn) btn.click();
        });
        
        // 等待單號改變
        try {
            await page.waitForFunction((oldDoc) => {
                const newDoc = document.querySelector('#ele_單號')?.value || '';
                return newDoc !== oldDoc && newDoc !== '';
            }, { timeout: 3000 }, prevDocNo);
        } catch (e) {
            console.log(`  (這天已經沒有上一筆資料了)`);
            break;
        }
        await sleep(1000); // 確保明細表也載入完畢
      }
  }

  // 5. 輸出 CSV
  console.log(`\n${'═'.repeat(50)}`);
  writeCSV(path.join(OUTPUT_DIR, `documents_master_${typeArg}.csv`),
    ['doc_id','type','doc_date','customer_name','total_amount','notes'],
    allMasterRows);
  writeCSV(path.join(OUTPUT_DIR, `documents_detail_${typeArg}.csv`),
    ['doc_id','part_id','quantity','unit_price','subtotal'],
    allDetailRows);

  console.log(`\n✅ 爬取完成！主檔: ${allMasterRows.length} 筆, 明細: ${allDetailRows.length} 筆`);
  
  // 6. 產生 SQL 並匯入 (如果您需要自動匯入，可解除註解此段)
  // execSync(`node scripts/generate_document_sql.cjs`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  
  await browser.close();
})();
