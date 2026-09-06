/**
 * 舊系統 → 新系統 單據增量同步常駐程式
 *
 * 依單號編排邏輯增量抓取（只抓上次之後的新單）：
 *   2S2607040006 → 2(汐止) S(銷貨單) 260704(日期) 0006(流水號)
 *   第1碼: 1=松山, 2=汐止
 *   第2碼: S=銷貨, Q=報價, T=銷貨退回, R=進貨退回, B=進貨, I=詢價
 *
 * 使用方式:
 *   node scripts/sync_documents_daemon.cjs [--branch=both|songshan|xizhi]
 *     [--types=S,Q,T,R,B,I] [--interval=300] [--once] [--dry-run]
 *     [--target=remote|local|both|api] [--api-base=https://erp-autoparts-v13.pages.dev] [--start=2026-07-05] [--lookback=1]
 *     [--rescan-every=12] [--rescan-days=3] [--rescan]
 *
 * 行為:
 *   - 每輪（預設 300 秒）針對每分店、每單別查「今天」的單，
 *     用「上一筆」往回翻，翻到已同步過的流水號就停。
 *   - 每 N 輪（預設 12 輪 ≈ 1 小時）做一次「完整複查」：
 *     整天重抓近幾天（預設 3 天）的所有單據以覆蓋「改單」，
 *     並比對單號清單偵測「刪單」→ 在新系統標記 status='cancelled'（不硬刪）。
 *     加 --rescan 可強制本次執行就複查（常配 --once 使用）。
 *   - 啟動時第一輪會多查前一天，補漏 daemon 停機期間的單。
 *   - 同步狀態依 target 分開存放：output/doc_sync_state.<target>.json
 *     首次執行會從遠端 D1 讀取現有單號自動建立狀態。
 *   - 匯入時檢查料號是否存在於新系統 products 表，
 *     缺料號會在單據備註加上警示、明細備註標記，並記錄到 output/doc_sync_missing.csv。
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DB_NAME = 'erp-db';
const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const LEGACY_STATE_FILE = path.join(OUTPUT_DIR, 'doc_sync_state.json');
const MISSING_CSV = path.join(OUTPUT_DIR, 'doc_sync_missing.csv');
const BATCH_SQL = path.join(OUTPUT_DIR, 'doc_sync_batch.sql');

// 舊系統主機（2026-07 起改走 cck2；可用 --host= 覆寫）
const HOST = (process.argv.find(a => a.startsWith('--host='))?.split('=')[1] || 'cck2.uparts.info')
  .replace(/^https?:\/\//, '').replace(/\/$/, '');
const LOGIN_URL = `http://${HOST}/car2009/Default/`;
const DOC_URLS = {
  sales: `http://${HOST}/car2009/ts/`,
  quotation: `http://${HOST}/car2009/tq/`,
  salesReturn: `http://${HOST}/car2009/tt/`,
  purchaseReturn: `http://${HOST}/car2009/tr/`,
  purchase: `http://${HOST}/car2009/tb/`,
  inquiry: `http://${HOST}/car2009/tii/`,
};

// 單號第 2 碼 → 新系統單據類型
const TYPE_BY_CHAR = {
  S: 'sales',
  Q: 'quotation',
  T: 'salesReturn',
  R: 'purchaseReturn',
  B: 'purchase',
  I: 'inquiry',
};
const CHAR_BY_TYPE = Object.fromEntries(Object.entries(TYPE_BY_CHAR).map(([c, t]) => [t, c]));
const TYPE_NAMES = {
  sales: '銷貨單',
  quotation: '報價單',
  salesReturn: '銷退單',
  purchaseReturn: '進退單',
  purchase: '進貨單',
  inquiry: '詢價單',
};
// 採購類單據寫 supplier_name，其餘寫 customer_name
const PROCUREMENT_TYPES = new Set(['purchase', 'purchaseReturn', 'inquiry']);

// 單號第 1 碼 → 分店
const BRANCH_BY_CHAR = { 1: 'songshan', 2: 'xizhi' };
const CHAR_BY_BRANCH = { songshan: '1', xizhi: '2' };
const BRANCH_NAMES = { songshan: '松山店', xizhi: '汐止店' };

// ── 參數解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const hasFlag = (name) => args.includes(`--${name}`);

const branchArg = getArg('branch', 'both');
const BRANCHES = branchArg === 'both' ? ['songshan', 'xizhi'] : branchArg.split(',');
for (const b of BRANCHES) {
  if (!CHAR_BY_BRANCH[b]) { console.error(`未知分店: ${b}（支援 songshan / xizhi / both）`); process.exit(1); }
}

const typesArg = getArg('types', 'S,Q,T,R,B,I');
const TYPES = typesArg.split(',').map(t => {
  const key = t.trim();
  const type = TYPE_BY_CHAR[key.toUpperCase()] || (DOC_URLS[key] ? key : null);
  if (!type) { console.error(`未知單別: ${key}（支援 S,Q,T,R,B,I 或 sales 等名稱）`); process.exit(1); }
  return type;
});

const INTERVAL_SEC = Math.max(60, parseInt(getArg('interval', '300'), 10) || 300);
const RUN_ONCE = hasFlag('once');
const DRY_RUN = hasFlag('dry-run');
const TARGET = getArg('target', 'api'); // api=經線上 Worker API 寫入遠端（Wrangler D1 管理 API 異常時建議使用）
const API_BASE = getArg('api-base', 'https://erp-autoparts-v13.pages.dev').replace(/\/$/, '');
const START_DATE = getArg('start', '2026-07-05'); // 此日期(含)之前的單一律不處理
const LOOKBACK_DAYS = Math.max(1, parseInt(getArg('lookback', '1'), 10) || 1);
// 每 N 輪做一次「完整複查」：整天重抓（覆蓋改單）＋偵測被刪除的單（0 = 停用）
const RESCAN_EVERY = Math.max(0, parseInt(getArg('rescan-every', '12'), 10) || 0);
const FORCE_RESCAN = hasFlag('rescan');
// 複查時往回看幾天（改單/刪單通常發生在近幾天）
const RESCAN_DAYS = Math.max(1, parseInt(getArg('rescan-days', '3'), 10) || 3);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 單號解析 ──────────────────────────────────────────────
function parseDocNo(docNo) {
  const m = /^([12])([SQTRBI])(\d{6})(\d{4})$/.exec((docNo || '').trim().toUpperCase());
  if (!m) return null;
  return {
    branch: BRANCH_BY_CHAR[m[1]],
    type: TYPE_BY_CHAR[m[2]],
    yymmdd: m[3],
    seq: parseInt(m[4], 10),
    prefix: `${m[1]}${m[2]}${m[3]}`, // 分店+單別+日期，狀態表的 key
  };
}

function dateToYYMMDD(dateStr) {
  // '2026-07-05' → '260705'
  return dateStr.replace(/-/g, '').slice(2);
}

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── 同步狀態（依 target 分開，避免 local 同步後 api 跳過重抓）──
function getStateFile() {
  return path.join(OUTPUT_DIR, `doc_sync_state.${TARGET}.json`);
}

function loadState() {
  const stateFile = getStateFile();
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    // 舊版共用狀態檔：api 模式不沿用（可能已被 local 污染）
    if (TARGET !== 'api' && fs.existsSync(LEGACY_STATE_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(LEGACY_STATE_FILE, 'utf8'));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function saveState(state) {
  state.lastRunAt = new Date().toISOString();
  fs.writeFileSync(getStateFile(), JSON.stringify(state, null, 2), 'utf8');
}

function runWranglerJson(sqlCommand, remote = true) {
  const flag = remote ? '--remote' : '--local';
  const out = execSync(
    `npx wrangler d1 execute ${DB_NAME} ${flag} --command=${JSON.stringify(sqlCommand)} --json`,
    { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return JSON.parse(out)[0]?.results || [];
}

function dateFromDocNo(docNo) {
  const p = parseDocNo(docNo);
  if (!p) return '';
  return `20${p.yymmdd.slice(0, 2)}-${p.yymmdd.slice(2, 4)}-${p.yymmdd.slice(4, 6)}`;
}

async function apiRequest(branchId, apiPath, options = {}) {
  const url = `${API_BASE}${apiPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Active-Branch': branchId,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.error ? data.error : String(text).slice(0, 300);
    throw new Error(msg);
  }
  return data;
}

/** 首次執行時，從線上 API 讀取既有單號建立狀態 */
async function seedStateFromApi() {
  console.log(`🌱 建立 ${TARGET} 同步狀態：從線上 API (${API_BASE}) 讀取 ${START_DATE} 之後既有單號（僅記錄進度，不會重抓舊單）...`);
  const lastSeqByPrefix = {};
  for (const branch of BRANCHES) {
    let offset = 0;
    for (;;) {
      const docs = await apiRequest(branch, `/api/documents?limit=500&offset=${offset}`);
      const list = Array.isArray(docs) ? docs : [];
      if (list.length === 0) break;
      for (const row of list) {
        if (row.date && row.date < START_DATE) continue;
        const p = parseDocNo(row.doc_id);
        if (!p) continue;
        if (!lastSeqByPrefix[p.prefix] || p.seq > lastSeqByPrefix[p.prefix]) {
          lastSeqByPrefix[p.prefix] = p.seq;
        }
      }
      if (list.length < 500) break;
      offset += 500;
    }
  }
  console.log(`   已建立 ${Object.keys(lastSeqByPrefix).length} 個前綴的狀態。`);
  return { lastSeqByPrefix, seededAt: new Date().toISOString() };
}

/** 首次執行時，從 D1 現有單號建立「每個前綴的最後流水號」狀態 */
function seedStateFromD1() {
  console.log(`🌱 建立 ${TARGET} 同步狀態：從 D1 讀取 ${START_DATE} 之後既有單號（僅記錄進度，不會重抓舊單）...`);
  const useRemote = TARGET !== 'local';
  const rows = runWranglerJson(
    `SELECT doc_id FROM documents WHERE date >= '${START_DATE}'`, useRemote
  );
  const lastSeqByPrefix = {};
  for (const row of rows) {
    const p = parseDocNo(row.doc_id);
    if (!p) continue;
    if (!lastSeqByPrefix[p.prefix] || p.seq > lastSeqByPrefix[p.prefix]) {
      lastSeqByPrefix[p.prefix] = p.seq;
    }
  }
  console.log(`   已建立 ${Object.keys(lastSeqByPrefix).length} 個前綴的狀態。`);
  return { lastSeqByPrefix, seededAt: new Date().toISOString() };
}

// ── 瀏覽器 / 登入 ──────────────────────────────────────────
function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  return candidates.find(p => fs.existsSync(p));
}

async function ensurePageReady(page) {
  const isError = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return t.includes('502 Bad Gateway') || t.includes('Server Error') || t.includes('could not complete your request');
  }).catch(() => false);
  if (isError) throw new Error('舊系統回應 502 / Server Error');
}

async function isLoginPage(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('input')).some(i => i.type === 'password') &&
    !document.querySelector('#btn_search')
  ).catch(() => true);
}

async function autoFillLogin(page, branch) {
  // 汐止店有固定認證可自動填寫；其他分店僅能靠 cookie 或人工登入
  if (branch !== 'xizhi') return false;
  console.log(`  ✍️ 自動輸入${BRANCH_NAMES[branch]}登入認證...`);
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    const textInputs = inputs.filter(i => i.type === 'text' || !i.type);
    const passwordInput = inputs.find(i => i.type === 'password');
    if (!passwordInput) return;
    passwordInput.value = '1';
    const [serviceInput, userInput] = textInputs;
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
    // 嘗試按登入鈕
    const btn = Array.from(document.querySelectorAll('input[type=submit], button, input[type=button]'))
      .find(b => /登入|login|確定/i.test(b.value || b.innerText || ''));
    if (btn) btn.click();
  }).catch(() => {});
  return true;
}

async function ensureLoggedIn(session) {
  const { page, branch, cookiesFile } = session;
  try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
  await ensurePageReady(page);
  await sleep(2000);

  if (!(await isLoginPage(page))) return true;

  // 需要登入：先嘗試自動填寫，否則提示人工登入
  await autoFillLogin(page, branch);
  await sleep(3000);

  if (await isLoginPage(page)) {
    await page.evaluate(() => {
      document.title = '🔴 請在此視窗登入！';
      const b = document.createElement('div');
      b.style.cssText = 'background:#f00;color:#fff;text-align:center;font-size:22px;font-weight:bold;padding:12px;pointer-events:none;';
      b.textContent = '⚠️ 單據同步視窗：請在此登入！';
      document.body.prepend(b);
    }).catch(() => {});
    console.log(`  ⚠️ [${BRANCH_NAMES[branch]}] 需要人工登入，請在開啟的 Chrome 視窗登入（最多等 6 分鐘）...`);
    for (let i = 0; i < 120; i++) {
      await sleep(3000);
      if (!(await isLoginPage(page))) break;
    }
  }

  if (await isLoginPage(page)) {
    console.log(`  ❌ [${BRANCH_NAMES[branch]}] 登入逾時，本輪跳過此分店。`);
    return false;
  }

  fs.writeFileSync(cookiesFile, JSON.stringify(await page.cookies(), null, 2));
  console.log(`  ✅ [${BRANCH_NAMES[branch]}] 已登入，Cookie 已更新。`);
  return true;
}

/** 登入身分錯誤（session 被別的視窗切走）時：清除 Session Cookie（保留 MachineId 授權）後重新登入 */
async function forceRelogin(session) {
  const { page, branch } = session;
  console.log(`  🔁 [${BRANCH_NAMES[branch]}] 偵測到登入身分錯誤，清除 Session 後重新登入...`);
  try {
    const cookies = await page.cookies();
    const toDelete = cookies.filter(c => c.name !== 'MachineId');
    if (toDelete.length > 0) await page.deleteCookie(...toDelete);
  } catch {}
  return ensureLoggedIn(session);
}

async function createSession(branch) {
  const profileDir = path.join(__dirname, `.chrome-profile-sync-${branch}`);
  const cookiesFile = path.join(__dirname, `cookies_${branch}.json`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const executablePath = findChrome();
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1366, height: 860 },
    ...(executablePath ? { executablePath } : {}),
    userDataDir: profileDir,
    protocolTimeout: 1200000,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-popup-blocking',
      '--disable-extensions', '--no-proxy-server',
      '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable',
    ],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);

  if (fs.existsSync(cookiesFile)) {
    try {
      // 將儲存的 Cookie 網域改對應目前主機（cck ↔ cck2 切換時 MachineId 授權沿用同一組值）
      const saved = JSON.parse(fs.readFileSync(cookiesFile, 'utf8'))
        .map(c => ({ ...c, domain: HOST }));
      try { await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }); } catch {}
      await page.setCookie(...saved);
    } catch (e) {
      console.log(`  ⚠️ 載入 ${path.basename(cookiesFile)} 失敗: ${e.message}`);
    }
  }
  return { branch, browser, page, cookiesFile };
}

// ── 抓取 ──────────────────────────────────────────────────
/**
 * 在目前頁面（某單別）查詢指定日期。
 * 增量模式：往回翻到已同步的流水號為止，只回傳新單。
 * 複查模式（fullRescan）：整天全部重抓（覆蓋改單），並回傳當天完整單號清單供刪單偵測。
 */
async function scrapeNewDocsForDate(page, branch, type, dateStr, state, fullRescan = false) {
  const branchChar = CHAR_BY_BRANCH[branch];
  const typeChar = CHAR_BY_TYPE[type];
  const expectPrefix = `${branchChar}${typeChar}${dateToYYMMDD(dateStr)}`;
  const lastSeq = fullRescan ? 0 : (state.lastSeqByPrefix[expectPrefix] || 0);

  await page.evaluate((d) => {
    const docNoInput = document.querySelector('#ele_單號');
    if (docNoInput) docNoInput.value = '';
    const searchInput = document.querySelector('#ele_QueryMaster');
    if (searchInput) { searchInput.value = d; searchInput.focus(); }
    document.querySelector('#btn_QueryMaster')?.click();
  }, dateStr);

  try {
    await page.waitForFunction(() => document.querySelector('#ele_單號')?.value !== '', { timeout: 5000 });
  } catch {
    console.log(`  ・${TYPE_NAMES[type]} ${dateStr}: 查無單據`);
    return { docs: [], prefix: expectPrefix, seenDocNos: new Set(), complete: true, hadData: false };
  }
  await sleep(1200); // 等明細 AJAX

  const latestDocNo = await page.evaluate(() => document.querySelector('#ele_單號')?.value || '');

  // 分店身分防呆：若登入的帳號顯示的是別家分店的單，代表 session 被切換（例如另一個
  // 登入視窗佔用同帳號），此時絕不能拿來做刪單判斷，直接跳過本單別。
  const latestParsed = parseDocNo(latestDocNo);
  if (latestParsed && latestParsed.branch && latestParsed.branch !== branch) {
    console.log(`  ❌ ${TYPE_NAMES[type]} ${dateStr}: 畫面顯示的是【${BRANCH_NAMES[latestParsed.branch]}】的單號 ${latestDocNo}，` +
      `與預期的【${BRANCH_NAMES[branch]}】不符！跳過本單別。`);
    return { docs: [], prefix: expectPrefix, seenDocNos: new Set(), complete: false, hadData: true, branchMismatch: true };
  }

  console.log(`  ・${TYPE_NAMES[type]} ${dateStr}: 最新單號 ${latestDocNo}` +
    (fullRescan ? '（複查模式：整天重抓）' : `（上次已同步至流水號 ${lastSeq}）`));

  const newDocs = [];
  const seen = new Set();
  const seenDocNos = new Set(); // 當天實際存在於舊系統的單號（前綴相符者）

  while (true) {
    const docData = await page.evaluate(() => {
      const getValue = (sel) => {
        const el = document.querySelector(sel);
        return el ? (el.value || el.innerText || '').trim() : '';
      };
      const docNo = getValue('#ele_單號');
      const docDate = getValue('#ele_交易日期');
      const customer = getValue('#ele_對象名稱');
      const note = getValue('#ele_備註');
      const grid = document.querySelector('#display_DataGridDetail table') || document.querySelector('#DataGridDetail');
      let items = [];
      if (grid) {
        grid.querySelectorAll('tbody tr').forEach(tr => {
          const f = (field) => {
            const el = tr.querySelector(`input[fieldname="${field}"]`);
            return el ? el.value.trim() : '';
          };
          const partNo = f('零件號碼');
          if (partNo) {
            items.push({
              partNo,
              qty: f('數量') || '1',
              price: f('單價') || '0',
            });
          }
        });
      }
      return { docNo, docDate, customer, note, items };
    });

    if (!docData.docNo || seen.has(docData.docNo)) break;
    seen.add(docData.docNo);

    const parsed = parseDocNo(docData.docNo);
    if (parsed && parsed.prefix === expectPrefix) {
      seenDocNos.add(docData.docNo.toUpperCase());
      if (parsed.seq <= lastSeq) break; // 翻到已同步的單了，停止（增量模式）
      newDocs.push({ ...docData, parsed, type, branch, dateStr });
    }
    // 前綴不符（跨日或格式異常）就跳過但繼續翻，避免漏單

    const prevDocNo = docData.docNo;
    await page.evaluate(() => document.querySelector('#btn_UpRecord')?.click());
    try {
      await page.waitForFunction((oldDoc) => {
        const v = document.querySelector('#ele_單號')?.value || '';
        return v !== oldDoc && v !== '';
      }, { timeout: 3000 }, prevDocNo);
    } catch {
      break; // 這天沒有上一筆了
    }
    await sleep(800);
  }

  return { docs: newDocs.reverse(), prefix: expectPrefix, seenDocNos, complete: true, hadData: true };
}

// ── 缺料號檢查 ────────────────────────────────────────────
async function checkMissingParts(partIds) {
  if (TARGET === 'api') {
    return checkMissingPartsApi(partIds);
  }
  const missing = new Set();
  const unique = [...new Set(partIds.map(p => p.trim()).filter(Boolean))];
  if (unique.length === 0) return missing;

  const useRemote = TARGET !== 'local';
  const CHUNK = 50;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const inList = chunk.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
    try {
      const rows = runWranglerJson(`SELECT p_id FROM products WHERE p_id IN (${inList})`, useRemote);
      const found = new Set(rows.map(r => r.p_id));
      chunk.forEach(p => { if (!found.has(p)) missing.add(p); });
    } catch (e) {
      console.log(`  ⚠️ 料號檢查失敗（略過警示標記）: ${e.message.split('\n')[0]}`);
    }
  }
  return missing;
}

function appendMissingCsv(rows) {
  const exists = fs.existsSync(MISSING_CSV);
  const lines = rows.map(r => `${r.time},${r.docId},${r.partId}`);
  const content = (exists ? '' : '\uFEFFtime,doc_id,part_id\n') + lines.join('\n') + '\n';
  fs.appendFileSync(MISSING_CSV, content, 'utf8');
}

async function checkMissingPartsApi(partIds) {
  const missing = new Set();
  const unique = [...new Set(partIds.map((p) => p.trim()).filter(Boolean))];
  if (unique.length === 0) return missing;

  const found = new Set();
  let cursor = 0;
  try {
    for (;;) {
      const res = await fetch(`${API_BASE}/api/products?cursor=${cursor}&limit=2000`);
      if (!res.ok) throw new Error(`products API HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      for (const p of items) {
        if (p.p_id) found.add(p.p_id);
      }
      if (Array.isArray(data) || !data.hasMore || data.nextCursor == null || items.length === 0) break;
      cursor = data.nextCursor;
    }
    unique.forEach((p) => { if (!found.has(p)) missing.add(p); });
  } catch (e) {
    console.log(`  ⚠️ 料號檢查失敗（略過警示標記）: ${e.message.split('\n')[0]}`);
  }
  return missing;
}

function buildApiDocPayload(doc, missingParts) {
  const partyField = PROCUREMENT_TYPES.has(doc.type) ? 'supplier_name' : 'customer_name';
  const docMissing = doc.items.filter((it) => missingParts.has(it.partNo.trim())).map((it) => it.partNo.trim());
  let notes = doc.note || '';
  if (docMissing.length > 0) {
    const warn = `⚠️ 缺料號待補正: ${[...new Set(docMissing)].join(', ')}`;
    notes = notes ? `${notes}\n${warn}` : warn;
  }
  const items = doc.items.map((it) => {
    const pid = it.partNo.trim();
    return {
      p_id: pid,
      part_number: pid,
      qty: parseFloat(String(it.qty).replace(/,/g, '')) || 0,
      unit_price: parseFloat(String(it.price).replace(/,/g, '')) || 0,
      note: missingParts.has(pid) ? '⚠️ 新系統無此料號' : '',
    };
  });
  return {
    doc_id: doc.docNo,
    type: doc.type,
    date: doc.dateStr,
    status: 'completed',
    branch_id: doc.branch,
    notes,
    [partyField]: doc.customer,
    items,
  };
}

async function importDocsViaApi(docs, missingParts, cancelledIds = []) {
  let ok = 0;
  let fail = 0;
  let firstFailReason = '';

  for (const doc of docs) {
    try {
      const body = buildApiDocPayload(doc, missingParts);
      await apiRequest(doc.branch, '/api/documents', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      ok++;
    } catch (e) {
      fail++;
      if (!firstFailReason) firstFailReason = e.message;
      console.log(`  ❌ API 匯入失敗 ${doc.docNo}: ${e.message}`);
    }
  }

  for (const docId of cancelledIds) {
    const parsed = parseDocNo(docId);
    if (!parsed) continue;
    const partyField = PROCUREMENT_TYPES.has(parsed.type) ? 'supplier_name' : 'customer_name';
    const body = {
      doc_id: docId,
      type: parsed.type,
      date: dateFromDocNo(docId),
      status: 'cancelled',
      branch_id: parsed.branch,
      notes: '⚠️ 舊系統已刪除此單',
      items: [],
      [partyField]: '',
    };
    try {
      await apiRequest(parsed.branch, '/api/documents', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      ok++;
    } catch (e) {
      fail++;
      if (!firstFailReason) firstFailReason = e.message;
      console.log(`  ❌ API 作廢失敗 ${docId}: ${e.message}`);
    }
  }

  console.log(`  API 匯入結果: 成功 ${ok} / 失敗 ${fail}`);
  if (fail > 0 && firstFailReason) {
    console.log(`  主要原因: ${firstFailReason}`);
  }
  return fail === 0;
}

async function detectDeletedDocsViaApi(rescanResults, dates) {
  const cancelledIds = [];
  for (const branch of BRANCHES) {
    for (const dateStr of dates) {
      try {
        const docs = await apiRequest(branch, `/api/documents?datePrefix=${dateStr}&limit=500`);
        const list = Array.isArray(docs) ? docs : [];
        for (const row of list) {
          if (row.status === 'cancelled') continue;
          const docId = String(row.doc_id || '').toUpperCase();
          const parsed = parseDocNo(docId);
          if (!parsed) continue;
          const result = rescanResults.get(parsed.prefix);
          if (!result || !result.complete) continue;
          if (result.seenDocNos.has(docId)) continue;
          if (!result.hadData) {
            console.log(`  ⚠️ ${docId}: 舊系統當天查無資料，為安全起見不自動作廢，請人工確認是否已刪單。`);
            continue;
          }
          cancelledIds.push(docId);
        }
      } catch (e) {
        console.log(`  ⚠️ 刪單偵測查詢失敗（${branch}/${dateStr}），本輪略過: ${e.message.split('\n')[0]}`);
      }
    }
  }
  return { statements: [], cancelledIds };
}

// ── SQL 產生與匯入 ────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/'/g, "''");

function buildSql(docs, missingParts) {
  const statements = [];
  for (const doc of docs) {
    const partyColumn = PROCUREMENT_TYPES.has(doc.type) ? 'supplier_name' : 'customer_name';
    const docMissing = doc.items.filter(it => missingParts.has(it.partNo.trim())).map(it => it.partNo.trim());
    let notes = doc.note || '';
    if (docMissing.length > 0) {
      const warn = `⚠️ 缺料號待補正: ${[...new Set(docMissing)].join(', ')}`;
      notes = notes ? `${notes}\n${warn}` : warn;
    }
    statements.push(
      `INSERT OR REPLACE INTO documents (doc_id, type, date, ${partyColumn}, notes, status, branch_id) ` +
      `VALUES ('${esc(doc.docNo)}', '${doc.type}', '${esc(doc.dateStr)}', '${esc(doc.customer)}', '${esc(notes)}', 'completed', '${doc.branch}');`
    );
    statements.push(`DELETE FROM document_items WHERE doc_id = '${esc(doc.docNo)}';`);
    for (const it of doc.items) {
      const pid = it.partNo.trim();
      const qty = parseFloat(String(it.qty).replace(/,/g, '')) || 0;
      const price = parseFloat(String(it.price).replace(/,/g, '')) || 0;
      const itemNote = missingParts.has(pid) ? '⚠️ 新系統無此料號' : '';
      statements.push(
        `INSERT INTO document_items (doc_id, p_id, part_number, qty, unit_price, note) ` +
        `VALUES ('${esc(doc.docNo)}', '${esc(pid)}', '${esc(pid)}', ${qty}, ${price}, '${esc(itemNote)}');`
      );
    }
  }
  return statements;
}

function wranglerExecErrorMessage(error) {
  const chunks = [];
  if (error?.stderr) chunks.push(String(error.stderr));
  if (error?.stdout) chunks.push(String(error.stdout));
  if (error?.message) chunks.push(String(error.message));
  const text = chunks.join('\n').trim();
  if (/Authentication error|code:\s*10000/i.test(text)) {
    return 'Cloudflare D1 認證失敗，請執行 npx wrangler login 重新登入後再試。';
  }
  if (/code:\s*7500|internal error/i.test(text)) {
    return 'Cloudflare D1 API 內部錯誤，請稍後重試或到 Cloudflare 儀表板確認資料庫狀態。';
  }
  return text.split('\n').find((line) => line.trim()) || '未知錯誤';
}

function executeSql(statements, remote) {
  const flag = remote ? '--remote' : '--local';
  const sqlText = 'PRAGMA defer_foreign_keys = ON;\n' + statements.join('\n') + '\n';
  fs.writeFileSync(BATCH_SQL, sqlText, 'utf8');
  try {
    execSync(`npx wrangler d1 execute ${DB_NAME} ${flag} --file=${JSON.stringify(BATCH_SQL)} --yes`, {
      cwd: ROOT_DIR, stdio: 'pipe',
    });
    return true;
  } catch (e) {
    const reason = wranglerExecErrorMessage(e);
    console.log(`  ⚠️ 檔案模式匯入失敗（${remote ? 'remote' : 'local'}）：${reason}`);
    console.log('  ↪ 改為逐條執行...');
    let ok = 0, fail = 0;
    let firstFailReason = '';
    for (const sql of statements) {
      try {
        execSync(`npx wrangler d1 execute ${DB_NAME} ${flag} --command=${JSON.stringify(sql)} --json`, {
          cwd: ROOT_DIR, stdio: 'pipe',
        });
        ok++;
      } catch (err) {
        fail++;
        if (!firstFailReason) firstFailReason = wranglerExecErrorMessage(err);
        console.log(`    ❌ 失敗: ${sql.slice(0, 100)}...`);
      }
    }
    console.log(`  逐條執行結果: 成功 ${ok} / 失敗 ${fail}`);
    if (fail > 0 && firstFailReason) {
      console.log(`  主要原因: ${firstFailReason}`);
    }
    return fail === 0;
  }
}

// ── 刪單偵測（僅複查模式） ─────────────────────────────────
/**
 * 比對新系統 D1 與舊系統當天實際存在的單號，
 * 找出「新系統有、舊系統已刪除」的單，產生作廢 SQL（標記 status='cancelled'，不硬刪）。
 */
function detectDeletedDocs(rescanResults, dates) {
  const statements = [];
  const cancelledIds = [];
  const useRemote = TARGET !== 'local';

  let dbRows = [];
  try {
    const inList = dates.map(d => `'${d}'`).join(',');
    dbRows = runWranglerJson(
      `SELECT doc_id FROM documents WHERE date IN (${inList}) AND status != 'cancelled'`, useRemote
    );
  } catch (e) {
    console.log(`  ⚠️ 刪單偵測查詢失敗，本輪略過: ${e.message.split('\n')[0]}`);
    return { statements, cancelledIds };
  }

  for (const row of dbRows) {
    const docId = (row.doc_id || '').toUpperCase();
    const parsed = parseDocNo(docId);
    if (!parsed) continue;
    const result = rescanResults.get(parsed.prefix);
    if (!result || !result.complete) continue; // 這輪沒複查到此前綴，不判斷
    if (result.seenDocNos.has(docId)) continue; // 舊系統還在，正常

    if (!result.hadData && dbRows.some(r => (r.doc_id || '').toUpperCase().startsWith(parsed.prefix))) {
      // 舊系統當天查無任何單，但新系統有 → 可能是整批刪除，也可能是查詢逾時，安全起見不自動作廢
      console.log(`  ⚠️ ${docId}: 舊系統當天查無資料，為安全起見不自動作廢，請人工確認是否已刪單。`);
      continue;
    }

    cancelledIds.push(docId);
    statements.push(
      `UPDATE documents SET status = 'cancelled', notes = CASE ` +
      `WHEN notes IS NULL OR notes = '' THEN '⚠️ 舊系統已刪除此單' ` +
      `WHEN notes LIKE '%舊系統已刪除%' THEN notes ` +
      `ELSE notes || char(10) || '⚠️ 舊系統已刪除此單' END ` +
      `WHERE doc_id = '${esc(row.doc_id)}';`
    );
  }
  return { statements, cancelledIds };
}

// ── 主流程 ────────────────────────────────────────────────
async function runCycle(sessions, state, { isFirstCycle, fullRescan }) {
  const today = todayStr();
  const lookback = fullRescan ? RESCAN_DAYS : (isFirstCycle ? Math.max(LOOKBACK_DAYS, 2) : LOOKBACK_DAYS);
  const dates = [];
  for (let i = lookback - 1; i >= 0; i--) {
    const d = todayStr(i);
    if (d >= START_DATE) dates.push(d);
  }
  if (dates.length === 0) {
    console.log(`（今天 ${today} 早於起始日 ${START_DATE}，不處理）`);
    return;
  }
  if (fullRescan) {
    console.log(`🔍 本輪為「完整複查」：重抓 ${dates.join('、')} 全部單據（覆蓋改單）並偵測刪單。`);
  }

  const allNewDocs = [];
  const rescanResults = new Map(); // prefix → { seenDocNos, complete, hadData }

  for (const session of sessions) {
    const { page, branch } = session;
    console.log(`\n── ${BRANCH_NAMES[branch]} ──`);
    let loggedIn = false;
    try {
      loggedIn = await ensureLoggedIn(session);
    } catch (e) {
      console.log(`  ❌ [${BRANCH_NAMES[branch]}] 登入檢查失敗: ${e.message}`);
    }
    if (!loggedIn) continue;

    // 最多嘗試 2 次：若偵測到登入身分是別家分店（session 被其他視窗切換），
    // 會清除 Session 重新登入後重跑一次。
    let branchDocs = [];
    let branchRescan = new Map();
    for (let attempt = 1; attempt <= 2; attempt++) {
      branchDocs = [];
      branchRescan = new Map();
      let mismatch = false;

      for (const type of TYPES) {
        try {
          await page.goto(DOC_URLS[type], { waitUntil: 'domcontentloaded' });
          await ensurePageReady(page);
          await sleep(1500);
          for (const dateStr of dates) {
            const result = await scrapeNewDocsForDate(page, branch, type, dateStr, state, fullRescan);
            if (result.branchMismatch) { mismatch = true; break; }
            if (result.docs.length > 0) {
              console.log(`  📥 ${TYPE_NAMES[type]} ${dateStr}: ${fullRescan ? '重抓' : '發現'} ${result.docs.length} 張單 (${result.docs.map(d => d.docNo).join(', ')})`);
              branchDocs.push(...result.docs);
            }
            if (fullRescan) branchRescan.set(result.prefix, result);
          }
        } catch (e) {
          console.log(`  ⚠️ [${BRANCH_NAMES[branch]}][${TYPE_NAMES[type]}] 抓取失敗: ${e.message.split('\n')[0]}`);
        }
        if (mismatch) break;
      }

      if (!mismatch) break;
      if (attempt === 1) {
        const ok = await forceRelogin(session).catch(() => false);
        if (!ok) {
          console.log(`  ❌ [${BRANCH_NAMES[branch]}] 重新登入失敗，本輪跳過此分店。`);
          branchDocs = []; branchRescan = new Map();
          break;
        }
      } else {
        console.log(`  ❌ [${BRANCH_NAMES[branch]}] 重新登入後身分仍不符，本輪跳過此分店（請人工檢查舊系統登入帳號）。`);
        branchDocs = []; branchRescan = new Map();
      }
    }

    allNewDocs.push(...branchDocs);
    for (const [k, v] of branchRescan) rescanResults.set(k, v);
  }

  // 刪單偵測（只在複查模式做）
  let deletionStatements = [];
  let cancelledIds = [];
  if (fullRescan && rescanResults.size > 0) {
    const deleted = TARGET === 'api'
      ? await detectDeletedDocsViaApi(rescanResults, dates)
      : detectDeletedDocs(rescanResults, dates);
    deletionStatements = deleted.statements;
    cancelledIds = deleted.cancelledIds;
    if (cancelledIds.length > 0) {
      console.log(`\n🗑️ 偵測到 ${cancelledIds.length} 張單在舊系統已刪除，將標記為作廢: ${cancelledIds.join(', ')}`);
    }
  }

  if (allNewDocs.length === 0 && deletionStatements.length === 0 && cancelledIds.length === 0) {
    console.log(`\n（本輪無新單據）`);
    return;
  }

  // 缺料號檢查
  const allPartIds = allNewDocs.flatMap(d => d.items.map(it => it.partNo));
  const missingParts = await checkMissingParts(allPartIds);
  if (missingParts.size > 0) {
    console.log(`\n⚠️ 缺料號警示（新系統 products 無資料，請人工補正）:`);
    const missingRows = [];
    for (const doc of allNewDocs) {
      for (const it of doc.items) {
        if (missingParts.has(it.partNo.trim())) {
          console.log(`   - ${doc.docNo} → ${it.partNo}`);
          missingRows.push({ time: new Date().toISOString(), docId: doc.docNo, partId: it.partNo.trim() });
        }
      }
    }
    if (!DRY_RUN && missingRows.length > 0) appendMissingCsv(missingRows);
  }

  const statements = [...buildSql(allNewDocs, missingParts), ...deletionStatements];
  console.log(`\n共 ${allNewDocs.length} 張單（含改單覆蓋）、${cancelledIds.length} 張作廢${TARGET === 'api' ? '' : `、${statements.length} 條 SQL`}。`);

  if (DRY_RUN) {
    fs.writeFileSync(BATCH_SQL, 'PRAGMA defer_foreign_keys = ON;\n' + statements.join('\n') + '\n', 'utf8');
    console.log(`🧪 dry-run 模式：SQL 已寫入 ${path.relative(ROOT_DIR, BATCH_SQL)}，未匯入、未更新狀態。`);
    return;
  }

  let allOk = true;
  if (TARGET === 'api') {
    console.log(`⬆️ 經線上 API 匯入遠端 D1（${API_BASE}）...`);
    allOk = await importDocsViaApi(allNewDocs, missingParts, cancelledIds) && allOk;
  } else {
    if (TARGET === 'remote' || TARGET === 'both') {
      console.log('⬆️ 匯入遠端 D1（Wrangler）...');
      allOk = executeSql(statements, true) && allOk;
    }
    if (TARGET === 'local' || TARGET === 'both') {
      console.log('⬆️ 匯入本地 D1...');
      allOk = executeSql(statements, false) && allOk;
    }
  }

  if (allOk) {
    for (const doc of allNewDocs) {
      const { prefix, seq } = doc.parsed;
      if (!state.lastSeqByPrefix[prefix] || seq > state.lastSeqByPrefix[prefix]) {
        state.lastSeqByPrefix[prefix] = seq;
      }
    }
    saveState(state);
    console.log(`✅ 同步完成，狀態已更新（${Object.keys(state.lastSeqByPrefix).length} 個前綴）。`);
  } else {
    console.log('⚠️ 部分匯入失敗，狀態未更新，下一輪會重抓這些單（INSERT OR REPLACE 不會重複）。');
  }
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('═'.repeat(60));
  console.log('🔄 舊系統 → 新系統 單據增量同步');
  console.log(`   分店: ${BRANCHES.map(b => BRANCH_NAMES[b]).join(' + ')}`);
  console.log(`   單別: ${TYPES.map(t => TYPE_NAMES[t]).join(', ')}`);
  console.log(`   模式: ${RUN_ONCE ? '單次執行' : `每 ${INTERVAL_SEC} 秒一輪`}${DRY_RUN ? '（dry-run 不寫入）' : ''}`);
  console.log(`   目標: ${TARGET === 'api' ? `api (${API_BASE})` : `${TARGET} D1`} / 起始日: ${START_DATE}`);
  console.log(`   複查: ${RESCAN_EVERY > 0 ? `每 ${RESCAN_EVERY} 輪完整複查近 ${RESCAN_DAYS} 天（處理改單/刪單）` : '停用'}${FORCE_RESCAN ? '（本次強制複查）' : ''}`);
  console.log('═'.repeat(60));

  let state = loadState();
  if (!state || !state.lastSeqByPrefix) {
    state = TARGET === 'api' ? await seedStateFromApi() : seedStateFromD1();
    if (!DRY_RUN) saveState(state);
  }

  const sessions = [];
  for (const branch of BRANCHES) {
    console.log(`\n🌐 啟動 ${BRANCH_NAMES[branch]} 瀏覽器...`);
    sessions.push(await createSession(branch));
  }

  let cycleCount = 0;
  while (true) {
    cycleCount++;
    const fullRescan = FORCE_RESCAN || (RESCAN_EVERY > 0 && cycleCount % RESCAN_EVERY === 0);
    console.log(`\n${'─'.repeat(60)}\n⏰ ${new Date().toLocaleString('zh-TW')} 開始同步輪（第 ${cycleCount} 輪）...`);
    try {
      await runCycle(sessions, state, { isFirstCycle: cycleCount === 1, fullRescan });
    } catch (e) {
      console.log(`❌ 本輪執行失敗: ${e.message}`);
    }

    if (RUN_ONCE) break;
    console.log(`\n💤 等待 ${INTERVAL_SEC} 秒後進行下一輪...（Ctrl+C 可停止）`);
    await sleep(INTERVAL_SEC * 1000);
  }

  for (const s of sessions) {
    try { await s.browser.close(); } catch {}
  }
  console.log('\n👋 同步程式已結束。');
})();
