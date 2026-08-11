const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

// 舊系統主機（與單據同步相同：2026-07 起改走 cck2；可用 --host= 覆寫）
const HOST = (process.argv.find(a => a.startsWith('--host='))?.split('=')[1] || 'cck2.uparts.info')
  .replace(/^https?:\/\//, '').replace(/\/$/, '');
const LOGIN_URL = `http://${HOST}/car2009/Default/`;
const DOC_URLS = {
  quotation: `http://${HOST}/car2009/tq/`,
  sales: `http://${HOST}/car2009/ts/`,
  salesReturn: `http://${HOST}/car2009/tt/`,
  inquiry: `http://${HOST}/car2009/tii/`,
  po: `http://${HOST}/car2009/tip/`,            // 採購單 (Purchase Order)
  purchase: `http://${HOST}/car2009/tb/`,          // 進貨單 (Purchase Inbound) - 已修正從 /tip/ 變更為 /tb/
  purchaseReturn: `http://${HOST}/car2009/tr/`,
  order: `http://${HOST}/car2009/to/`,           // 客戶訂單 (Sales Order)
};

// 參數解析
const args = process.argv.slice(2);
const branchArg = args.find(a => a.startsWith('--branch='))?.split('=')[1] || 'songshan';
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];

const allowedBranches = ['songshan', 'xizhi', 'linkou'];
if (!allowedBranches.includes(branchArg)) {
  console.log(`未知的分店代號: ${branchArg}。支援的分店有: ${allowedBranches.join(', ')}`);
  process.exit(1);
}

if (!typeArg || !startArg || !endArg) {
  console.log(`
使用方式: node scripts/scrape_documents.cjs --branch=<分店代號> --type=<單據類型> --start=<開始日期> --end=<結束日期> [--host=cck2.uparts.info]
分店代號支援: songshan (松山店), xizhi (汐止店), linkou (林口店) (預設為 songshan)
單據類型支援: quotation (報價), sales (銷貨), salesReturn (銷退), inquiry (詢價), po (採購), purchase (進貨), purchaseReturn (進退), order (訂單), all (一次搬移8種)
範例: node scripts/scrape_documents.cjs --branch=xizhi --type=purchase --start=2026-05-18 --end=2026-05-18
`);
  process.exit(1);
}

if (typeArg !== 'all' && !DOC_URLS[typeArg]) {
  console.log('未知的單據類型。');
  process.exit(1);
}
const OUTPUT_DIR = path.join(__dirname, '..', 'output', branchArg);
const COOKIES_FILE = path.join(__dirname, `cookies_${branchArg}.json`);
const PROFILE_DIR = path.join(__dirname, `.chrome-profile-docs-${branchArg}`);

function remapCookiesForHost(cookies) {
  return (cookies || []).map((c) => ({ ...c, domain: HOST }));
}

function loadCookiesFromFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return remapCookiesForHost(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (e) {
    console.log(`⚠️ 讀取 Cookie 失敗 (${path.basename(filePath)}): ${e.message}`);
    return null;
  }
}

// 自動啟動防休眠程式 (在新視窗開啟)，防止重複開啟
if (!process.env.KEEP_AWAKE_STARTED) {
  console.log('🛡️ 正在自動啟動防休眠程式...');
  const keepAwakePath = path.join(__dirname, 'keep_awake_api.ps1');
  try {
    spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', keepAwakePath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
    process.env.KEEP_AWAKE_STARTED = '1';
  } catch (e) {
    console.log('⚠️ 防休眠程式啟動失敗，請確保您有執行 PowerShell 腳本的權限。');
  }
}

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
    protocolTimeout: 1200000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-popup-blocking']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);
  
  // 1. 登入檢查（主機與單據同步相同：預設 cck2）
  console.log(`\n[1] 檢查登入狀態...（主機: ${HOST}）`);
  try { await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' }); } catch {}
  try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
  await ensurePageReady(page);
  await sleep(2000);

  let cookiesLoaded = false;
  const branchCookies = loadCookiesFromFile(COOKIES_FILE);
  const cck2Cookies = loadCookiesFromFile(path.join(__dirname, 'cookies_cck2.json'));
  const songshanCookies = loadCookiesFromFile(path.join(__dirname, 'cookies_songshan.json'));
  const defaultCookies = loadCookiesFromFile(path.join(__dirname, 'cookies.json'));

  const preferredCookies = branchCookies
    || cck2Cookies
    || songshanCookies
    || defaultCookies;

  if (preferredCookies && preferredCookies.length > 0) {
    try {
      await page.setCookie(...preferredCookies);
      const mid = preferredCookies.find((c) => c.name === 'MachineId');
      if (mid) {
        console.log(`ℹ️ 已注入 Cookie／MachineId（${mid.value.slice(0, 8)}…）→ ${HOST}`);
      } else {
        console.log(`ℹ️ 已注入 ${preferredCookies.length} 個 Cookie → ${HOST}`);
      }
      try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
      await ensurePageReady(page);
      await sleep(2000);
      cookiesLoaded = true;
    } catch (e) {
      console.log(`⚠️ 注入 Cookie 失敗: ${e.message}`);
    }
  } else if (songshanCookies || defaultCookies) {
    // 僅注入 MachineId（無完整 session 時仍可通過裝置授權）
    const src = songshanCookies || defaultCookies;
    const machineIdCookie = src.find(c => c.name === 'MachineId');
    if (machineIdCookie) {
      try {
        await page.setCookie(machineIdCookie);
        console.log(`ℹ️ 已自動載入 MachineId 授權 Cookie (${machineIdCookie.value})，免去新裝置授權步驟。`);
        try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
        await ensurePageReady(page);
        await sleep(2000);
        cookiesLoaded = true;
      } catch (e) {
        console.log('⚠️ 載入 MachineId Cookie 失敗:', e.message);
      }
    }
  }
  
  const needLogin = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
           !document.querySelector('#btn_search');
  });

  if (needLogin) {
    // 嘗試自動填寫登入資訊 (若為汐止店)
    if (branchArg === 'xizhi') {
      console.log('✍️ 正在自動輸入汐止店登入認證 (服務編號: car00401, 帳號: b9)...');
      await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, select'));
        const textInputs = inputs.filter(i => i.tagName === 'INPUT' && (i.type === 'text' || !i.type));
        const passwordInput = inputs.find(i => i.tagName === 'INPUT' && i.type === 'password');
        
        if (passwordInput) {
          passwordInput.value = '1';
          
          let serviceInput = null;
          let userInput = null;
          
          for (const input of textInputs) {
            const id = (input.id || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            if (id.includes('service') || name.includes('service') || id.includes('center') || name.includes('center')) {
              serviceInput = input;
            } else if (id.includes('user') || name.includes('user') || id.includes('uid') || name.includes('uid') || id.includes('account') || name.includes('account')) {
              userInput = input;
            }
          }
          
          if (!serviceInput && textInputs.length >= 2) {
            serviceInput = textInputs[0];
            userInput = textInputs[1];
          } else if (!userInput && textInputs.length === 1) {
            userInput = textInputs[0];
          }
          
          if (serviceInput) {
            serviceInput.value = 'car00401';
            serviceInput.dispatchEvent(new Event('input', { bubbles: true }));
            serviceInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (userInput) {
            userInput.value = 'b9';
            userInput.dispatchEvent(new Event('input', { bubbles: true }));
            userInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }).catch(() => {});
    }

    await page.evaluate(() => {
      document.title = '🔴 請在此視窗登入！';
      const b = document.createElement('div');
      b.style.cssText = 'background:#f00;color:#fff;text-align:center;font-size:22px;font-weight:bold;padding:12px;pointer-events:none;';
      b.textContent = '⚠️ 爬蟲視窗：請在此登入！';
      document.body.prepend(b);
    }).catch(() => {});
    
    console.log('⚠️ 請在開啟的 Chrome 視窗手動登入！登入完成後程式會自動繼續...');
    for (let i = 0; i < 120; i++) {
      await sleep(3000);
      let isStillLogin = true;
      try {
        isStillLogin = await page.evaluate(() => Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') && !document.querySelector('#btn_search'));
      } catch (e) {
        // 網頁跳轉中 context 會失效，此為正常現象，忽略並繼續等待
        isStillLogin = true;
      }
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

  // 2. 確定處理類型與計算日期範圍
  const typesToProcess = typeArg === 'all'
    ? ['sales', 'quotation', 'inquiry', 'po', 'purchase', 'salesReturn', 'purchaseReturn', 'order']
    : [typeArg];

  const TYPE_NAMES = {
    sales: '銷貨單',
    quotation: '報價單',
    inquiry: '詢價單',
    po: '採購單',
    purchase: '進貨單',
    salesReturn: '銷退單',
    purchaseReturn: '進退單',
    order: '訂單'
  };

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

  const BRANCH_NAMES = {
    songshan: '松山店',
    xizhi: '汐止店',
    linkou: '林口店'
  };
  const branchName = BRANCH_NAMES[branchArg] || branchArg;

  const dateList = getDatesInRange(startArg, endArg);
  let isTerminated = false;

  for (const currentType of typesToProcess) {
    if (isTerminated) break;

    const targetUrl = DOC_URLS[currentType];
    const typeName = TYPE_NAMES[currentType] || currentType;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🚀 [單據搬家 - ${branchName}] 正在處理單據類型: ${currentType} (${typeName})`);
    console.log(`🔗 網址: ${targetUrl}`);
    console.log(`${'═'.repeat(60)}`);

    // 前往目標單據頁面
    console.log(`\n[2] 前往 ${typeName} 頁面...`);
    try { await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }); } catch {}
    await ensurePageReady(page);
    await sleep(2000);

    console.log(`\n[3] 準備逐日爬取，從 ${endArg} 爬到 ${startArg} (共 ${dateList.length} 天)...`);

    const allMasterRows = [];
    const allDetailRows = [];
    const processedDocNos = new Set();

    try {
      for (const targetDate of dateList) {
        if (isTerminated) break;
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
          if (isTerminated) break;

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
              currentType, 
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
    } catch (err) {
        console.log(`\n❌ [${typeName}] 執行中斷: ${err.message}`);
        if (err.message.includes('detached Frame') || err.message.includes('Execution context was destroyed')) {
            console.log(`⚠️ 偵測到網頁被強制登出或重新整理 (這是 ERP 系統本身的安全性自動登出)！`);
            console.log(`💾 系統將為您自動保存中斷前已抓取的進度...`);
            isTerminated = true;
        }
    } finally {
        // 5. 輸出 CSV
        console.log(`\n${'═'.repeat(50)}`);
        if (allMasterRows.length > 0) {
            writeCSV(path.join(OUTPUT_DIR, `documents_master_${currentType}.csv`),
              ['doc_id','type','doc_date','customer_name','total_amount','notes'],
              allMasterRows);
            writeCSV(path.join(OUTPUT_DIR, `documents_detail_${currentType}.csv`),
              ['doc_id','part_id','quantity','unit_price','subtotal'],
              allDetailRows);
            console.log(`\n✅ [${typeName}] 爬取已儲存！主檔: ${allMasterRows.length} 筆, 明細: ${allDetailRows.length} 筆`);
        } else {
            console.log(`\n⚠ [${typeName}] 尚未抓取到任何資料。`);
        }
    }
  }

  // 關閉瀏覽器
  await browser.close();
})();
