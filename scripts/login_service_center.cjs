/**
 * login_service_center.cjs — 開啟 Chrome 登入 uParts
 *
 * 用法:
 *   npm run login:uparts -- --from=songshan --direct
 *   npm run login:uparts -- --host=cck.uparts.info --from=xizhi --direct
 *   node scripts/login_service_center.cjs --host=cck2.uparts.info --from=songshan
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT_DIR = __dirname;
const DEFAULT_HOST = 'cck.uparts.info';
const DEFAULT_LOGIN_URL = (host) => `http://${host}/SERVICE_CENTER/`;
const DEFAULT_TARGET_URL = (host) => `http://${host}/car2009/Default/`;
const LOCAL_CREDS_FILE = path.join(SCRIPT_DIR, '.uparts-login.local');

const COOKIE_SOURCES = {
  songshan: path.join(SCRIPT_DIR, 'cookies_songshan.json'),
  default: path.join(SCRIPT_DIR, 'cookies.json'),
  xizhi: path.join(SCRIPT_DIR, 'cookies_xizhi.json'),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadLocalCredentials() {
  if (!fs.existsSync(LOCAL_CREDS_FILE)) return {};
  const creds = {};
  for (const line of fs.readFileSync(LOCAL_CREDS_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    creds[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return creds;
}

function resolveCookieFile(fromArg, cookiesArg) {
  if (cookiesArg) return path.resolve(cookiesArg);
  if (fromArg && COOKIE_SOURCES[fromArg]) return COOKIE_SOURCES[fromArg];
  if (fromArg) {
    console.warn(`⚠️ 未知的 --from=${fromArg}，改試 cookies.json`);
  }
  return COOKIE_SOURCES.default;
}

function remapCookiesForHost(cookies, host) {
  const normalized = host.replace(/^\./, '');
  return cookies.map((cookie) => ({
    ...cookie,
    domain: normalized,
  }));
}

async function ensurePageReady(page) {
  const isError = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return (
      t.includes('502 Bad Gateway') ||
      t.includes('Server Error') ||
      t.includes('could not complete your request')
    );
  });
  if (isError) {
    throw new Error('目標網站發生 502 Server Error 或崩潰！請稍後再試。');
  }
}

async function needLogin(page) {
  return page
    .evaluate(() => {
      const hasPassword = Array.from(document.querySelectorAll('input')).some(
        (i) => i.type === 'password'
      );
      const inApp = !!document.querySelector('#btn_search');
      const url = location.href.toLowerCase();
      if (url.includes('/car2009/') && !hasPassword) return false;
      return hasPassword && !inApp;
    })
    .catch(() => true);
}

async function isDeviceUnauthorized(page) {
  return page
    .evaluate(() => {
      const text = document.body?.innerText || '';
      return text.includes('裝置尚未授權') || text.includes('尚未授權');
    })
    .catch(() => false);
}

async function isPendingApproval(page) {
  return page
    .evaluate(() => (document.body?.innerText || '').includes('等待審核'))
    .catch(() => false);
}

async function enforceMachineId(page, machineIdValue, host) {
  if (!machineIdValue) return;
  const cookie = {
    name: 'MachineId',
    value: machineIdValue,
    domain: host.replace(/^\./, ''),
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 86400 * 365,
  };
  await page.setCookie(cookie);
  await page
    .evaluate((val) => {
      document.cookie = `MachineId=${encodeURIComponent(val)}; path=/`;
    }, machineIdValue)
    .catch(() => {});
}

async function injectCookies(page, cookieFile, host) {
  if (!fs.existsSync(cookieFile)) {
    console.log(`ℹ️ 找不到 Cookie 檔：${path.basename(cookieFile)}，將不注入既有 Session。`);
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
  const remapped = remapCookiesForHost(raw, host);
  const machineId = remapped.find((c) => c.name === 'MachineId');

  // 必須先進入目標網域，Puppeteer 才能正確寫入 Cookie
  try {
    await page.goto(`http://${host}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {}

  if (machineId) {
    await enforceMachineId(page, machineId.value, host);
    console.log(`✅ 已注入 MachineId（${machineId.value.slice(0, 8)}…）→ ${host}`);
  }

  const others = remapped.filter((c) => c.name !== 'MachineId');
  if (others.length > 0) {
    await page.setCookie(...others);
    console.log(`✅ 已注入 ${others.length} 個 Cookie（來源：${path.basename(cookieFile)}）`);
  }

  return machineId?.value || null;
}

async function verifyMachineId(page, expectedValue) {
  if (!expectedValue) return true;
  const cookies = await page.cookies();
  const current = cookies.find((c) => c.name === 'MachineId')?.value;
  if (current === expectedValue) return true;
  console.log(`⚠️ MachineId 不符（目前: ${current?.slice(0, 8) || '無'}…，預期: ${expectedValue.slice(0, 8)}…），重新注入…`);
  return false;
}

async function fillLoginForm(page, { service, user, password }) {
  if (!service && !user && !password) return false;
  return page.evaluate(
    ({ service, user, password }) => {
      const inputs = Array.from(document.querySelectorAll('input, select'));
      const textInputs = inputs.filter(
        (i) => i.tagName === 'INPUT' && (i.type === 'text' || !i.type)
      );
      const passwordInput = inputs.find(
        (i) => i.tagName === 'INPUT' && i.type === 'password'
      );
      if (!passwordInput) return false;

      let serviceInput = null;
      let userInput = null;

      for (const input of textInputs) {
        const id = (input.id || '').toLowerCase();
        const name = (input.name || '').toLowerCase();
        if (
          id.includes('service') ||
          name.includes('service') ||
          id.includes('center') ||
          name.includes('center') ||
          id.includes('serviceno') ||
          name.includes('serviceno')
        ) {
          serviceInput = input;
        } else if (
          id.includes('user') ||
          name.includes('user') ||
          id.includes('uid') ||
          name.includes('uid') ||
          id.includes('account') ||
          name.includes('account')
        ) {
          userInput = input;
        }
      }

      if (!serviceInput && textInputs.length >= 2) {
        serviceInput = textInputs[0];
        userInput = textInputs[1];
      } else if (!userInput && textInputs.length === 1) {
        userInput = textInputs[0];
      }

      const setVal = (el, val) => {
        if (!el || val == null || val === '') return;
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      setVal(serviceInput, service);
      setVal(userInput, user);
      setVal(passwordInput, password);
      return !!(service || user || password);
    },
    { service: service || '', user: user || '', password: password || '' }
  );
}

(async () => {
  const localCreds = loadLocalCredentials();
  const fromArg = parseArg('from') || 'songshan';
  const cookiesArg = parseArg('cookies');
  const host = (parseArg('host') || DEFAULT_HOST).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const directMode = hasFlag('direct');
  const loginUrl = parseArg('login') || (directMode ? DEFAULT_TARGET_URL(host) : DEFAULT_LOGIN_URL(host));
  const targetUrl = parseArg('target') || DEFAULT_TARGET_URL(host);
  const outFile = path.resolve(parseArg('out') || path.join(SCRIPT_DIR, host.startsWith('cck2') ? 'cookies_cck2.json' : 'cookies_cck.json'));
  const profileArg = parseArg('profile-dir');
  const profileDir = profileArg
    ? path.resolve(profileArg)
    : directMode
      ? path.join(SCRIPT_DIR, '.chrome-profile')
      : path.join(SCRIPT_DIR, '.chrome-profile-cck2');

  const service =
    parseArg('service') || localCreds.UPARTS_SERVICE || localCreds.SERVICE || '';
  const user = parseArg('user') || localCreds.UPARTS_USER || localCreds.USER || '';
  const password =
    parseArg('password') || localCreds.UPARTS_PASSWORD || localCreds.PASSWORD || '';

  const cookieFile = resolveCookieFile(fromArg, cookiesArg);
  const machineIdOverride = parseArg('machine-id');

  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find((p) => fs.existsSync(p));

  console.log('\n🔐 uParts 登入協助');
  console.log(`   主機：${host}`);
  console.log(`   模式：${directMode ? '直連 car2009（略過 SERVICE_CENTER，建議汐止/松山）' : 'SERVICE_CENTER 登入頁'}`);
  console.log(`   登入頁：${loginUrl}`);
  console.log(`   目標頁：${targetUrl}`);
  console.log(`   Cookie 輸出：${outFile}`);
  if (host.startsWith('cck2')) {
    console.log('\n⚠️  cck2 與 cck 的裝置授權分開管理；若出現「裝置尚未授權」，請改試：');
    console.log('   npm run login:uparts -- --from=songshan --direct');
    console.log('   或 npm run login:uparts -- --host=cck.uparts.info --from=xizhi --direct');
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    ...(executablePath ? { executablePath } : {}),
    userDataDir: profileDir,
    protocolTimeout: 120000,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-popup-blocking',
      '--ignore-certificate-errors',
    ],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(20000);

  page.on('dialog', async (dialog) => {
    const msg = dialog.message();
    console.log(`\n⚠️  瀏覽器提示：${msg}`);
    if (msg.includes('裝置尚未授權') || msg.includes('尚未授權')) {
      console.log('   → cck2 需後台核准此 MachineId，或改用 cck.uparts.info + --direct');
    }
    await dialog.accept().catch(() => {});
  });

  let machineIdValue = machineIdOverride || (await injectCookies(page, cookieFile, host));

  console.log(`\n[1] 開啟${directMode ? ' ERP 主頁' : ' SERVICE_CENTER'}…`);
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  } catch {}
  await ensurePageReady(page);
  await sleep(1500);

  if (machineIdValue && !(await verifyMachineId(page, machineIdValue))) {
    await enforceMachineId(page, machineIdValue, host);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
    } catch {}
    await sleep(1000);
  }

  if (await isDeviceUnauthorized(page)) {
    console.log('\n❌ 偵測到「這個裝置尚未授權!!!」');
    console.log('   原因：cck2 主機未核准此 MachineId（與 cck 授權不互通）。');
    console.log('\n   建議改走已驗證路徑（汐止 car00401）：');
    console.log('   npm run login:uparts -- --host=cck.uparts.info --from=xizhi --direct');
    console.log('   或在 uParts 後台為 cck2 / car00401 核准裝置。');
  }

  if (await isPendingApproval(page)) {
    console.log('\n⏳ 偵測到「等待審核…」');
    console.log('   → 請在 uParts 管理後台核准此裝置，或確認已注入正確的 MachineId Cookie。');
    console.log('   → 若已有松山店授權，可試：npm run login:uparts -- --from=songshan');
  }

  const loginRequired = await needLogin(page);

  if (loginRequired) {
    const filled = await fillLoginForm(page, { service, user, password });
    if (filled) {
      console.log(`\n✍️ 已自動填入登入欄位（服務編號: ${service || '—'}, 帳號: ${user || '—'}）`);
      console.log('   → 請在瀏覽器確認並按「登入」。');
    } else {
      console.log('\n⚠️ 未提供憑證，請在 Chrome 視窗手動輸入服務編號 / 帳號 / 密碼。');
      console.log(`   → 可建立 ${path.basename(LOCAL_CREDS_FILE)} 或加上 --service= --user= --password=`);
    }

    await page
      .evaluate(() => {
        document.title = '🔴 請在此視窗登入！';
        const b = document.createElement('div');
        b.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;text-align:center;font-size:20px;font-weight:bold;padding:12px;pointer-events:none;';
        b.textContent = '⚠️ 請在此視窗完成登入（或等待裝置審核通過）';
        document.body.prepend(b);
      })
      .catch(() => {});

    console.log('\n[2] 等待登入完成（最多 6 分鐘）…');
    for (let i = 0; i < 120; i++) {
      await sleep(3000);
      let stillLogin = true;
      try {
        stillLogin = await needLogin(page);
      } catch {
        stillLogin = true;
      }
      if (!stillLogin) {
        console.log(`✅ 登入成功（約 ${(i + 1) * 3}s）`);
        break;
      }
      if ((i + 1) % 10 === 0) {
        const pending = await isPendingApproval(page);
        console.log(
          pending
            ? `   仍在等待審核… (${(i + 1) * 3}s)`
            : `   等待登入中… (${(i + 1) * 3}s)`
        );
      }
    }
  } else {
    console.log('\n✅ Cookie 仍有效，無需重新登入。');
  }

  console.log(`\n[3] 導向 ${targetUrl}`);
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  } catch {}
  await ensurePageReady(page);
  await sleep(1500);

  const cookies = await page.cookies();
  fs.writeFileSync(outFile, JSON.stringify(cookies, null, 2));
  console.log(`\n💾 已儲存 ${cookies.length} 個 Cookie → ${path.basename(outFile)}`);

  if (await needLogin(page)) {
    console.log('\n❌ 登入可能尚未完成，請在瀏覽器完成登入後重新執行此腳本以更新 Cookie。');
  } else {
    console.log('\n🎉 登入狀態已就緒，可開始使用或執行爬蟲。');
  }

  console.log('\n💡 瀏覽器保持開啟；關閉此終端機視窗會一併關閉 Chrome。');
  await new Promise(() => {});
})().catch((err) => {
  console.error('\n❌ 登入腳本失敗:', err.message);
  process.exit(1);
});
