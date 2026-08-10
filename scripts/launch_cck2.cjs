/**
 * launch_cck2.cjs — 單獨登入 cck2.uparts.info 的操作視窗
 *
 * 目的：沿用這台電腦已授權的 MachineId / 既有 Session，開一個獨立 Chrome
 *       視窗供人工操作舊系統，不需要再向管理員申請新裝置授權。
 *
 * 用法:
 *   npm run open:cck2                 # 自動挑第一個可用的 Cookie 來源
 *   node scripts/launch_cck2.cjs --from=xizhi     # 指定用汐止 Cookie
 *   node scripts/launch_cck2.cjs --from=songshan  # 指定用松山 Cookie
 *
 * 行為:
 *   1. 依序嘗試 cookies_cck2_user.json（您上次的登入）→ cookies_xizhi.json → cookies_songshan.json
 *   2. 注入 Cookie（含 MachineId）後直達 car2009/Default/，Session 有效就直接進系統
 *   3. 若 Session 失效，因 MachineId 已注入（裝置已授權），您只要在視窗中
 *      輸入自己的帳密登入即可，不會再跳「這個裝置尚未授權」
 *   4. 登入成功後自動把您的 Session 存到 cookies_cck2_user.json，下次直接沿用
 *   5. 瀏覽器保持開啟；關閉此終端機視窗會一併關閉 Chrome
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = 'cck2.uparts.info';
const USER_COOKIES_FILE = path.join(__dirname, 'cookies_cck2_user.json');
// 專屬 profile，避免與爬蟲 / 同步程式互搶
const PROFILE_DIR = path.join(__dirname, '.chrome-profile-cck2-user');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const SOURCES = {
  user: USER_COOKIES_FILE,
  xizhi: path.join(__dirname, 'cookies_xizhi.json'),
  songshan: path.join(__dirname, 'cookies_songshan.json'),
};

const fromArg = parseArg('from');
const candidates = fromArg
  ? [SOURCES[fromArg] || path.resolve(fromArg)]
  : [SOURCES.user, SOURCES.xizhi, SOURCES.songshan];

async function isInsideSystem(page) {
  return page.evaluate(() => {
    const hasPassword = Array.from(document.querySelectorAll('input')).some(i => i.type === 'password');
    const text = document.body?.innerText || '';
    return !hasPassword && (location.href.includes('/car2009/') || text.includes('系統登出'));
  }).catch(() => false);
}

(async () => {
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));

  console.log('🚀 正在開啟 cck2 操作視窗...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    ...(executablePath ? { executablePath } : {}),
    userDataDir: PROFILE_DIR,
    protocolTimeout: 1200000,
    args: ['--start-maximized', '--no-sandbox', '--disable-popup-blocking',
           '--no-proxy-server', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  page.on('dialog', async d => {
    console.log(`  ⚠️ 網頁對話框: ${d.message()}`);
    await d.accept().catch(() => {});
  });

  // ── 依序嘗試各 Cookie 來源 ─────────────────────────────────────────
  let ready = false;
  for (const cookieFile of candidates) {
    if (!cookieFile || !fs.existsSync(cookieFile)) continue;
    console.log(`  嘗試 ${path.basename(cookieFile)} ...`);
    try { await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' }); } catch {}
    const saved = JSON.parse(fs.readFileSync(cookieFile, 'utf8')).map(c => ({ ...c, domain: HOST }));
    try { await page.setCookie(...saved); } catch (e) {
      console.log(`  ⚠️ Cookie 注入失敗: ${e.message}`);
      continue;
    }
    try { await page.goto(`http://${HOST}/car2009/Default/`, { waitUntil: 'domcontentloaded' }); } catch {}
    await sleep(2500);
    if (await isInsideSystem(page)) {
      console.log(`\n🎉 已用 ${path.basename(cookieFile)} 的既有登入狀態直接進入系統！`);
      ready = true;
      break;
    }
    console.log(`  ✗ ${path.basename(cookieFile)} 的 Session 已失效（MachineId 仍會沿用）`);
  }

  // ── Session 全失效 → 用已授權 MachineId 讓使用者自己登入 ──────────
  if (!ready) {
    console.log('\n⚠️ 既有 Session 均已失效，請在視窗中用您自己的帳密登入。');
    console.log('   （已沿用授權過的 MachineId，不會再跳「裝置尚未授權」）\n');
    try { await page.goto(`http://${HOST}/SERVICE_CENTER/`, { waitUntil: 'domcontentloaded' }); } catch {}
    await page.evaluate(() => {
      document.title = '🔵 請在此視窗登入 cck2';
      const b = document.createElement('div');
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#2563eb;color:#fff;text-align:center;font-size:20px;font-weight:bold;padding:10px;pointer-events:none;';
      b.textContent = '請輸入您的服務編號 / 帳號 / 密碼登入';
      document.body.prepend(b);
    }).catch(() => {});

    for (let w = 0; w < 600; w += 3) {
      await sleep(3000);
      if (await isInsideSystem(page)) {
        console.log(`✅ 登入成功 (${w + 3}s)`);
        ready = true;
        break;
      }
      if ((w + 3) % 30 === 0) console.log(`  等待登入... (${w + 3}s)`);
    }
  }

  // ── 保存您的 Session，下次直接沿用 ────────────────────────────────
  if (ready) {
    try {
      fs.writeFileSync(USER_COOKIES_FILE, JSON.stringify(await page.cookies(), null, 2));
      console.log(`💾 已將您的登入狀態存到 ${path.basename(USER_COOKIES_FILE)}，下次執行可直接進入。`);
    } catch (e) {
      console.log(`⚠️ Cookie 儲存失敗: ${e.message}`);
    }
    console.log('\n💡 視窗已就緒，可開始操作。請勿關閉此終端機，否則瀏覽器會一併關閉。');
  } else {
    console.log('\n❌ 等待逾時，登入未完成。您仍可繼續在視窗中操作，完成登入後重跑一次本指令即可保存狀態。');
  }

  await new Promise(() => {});
})().catch(err => { console.error('\n❌ 失敗:', err.message); process.exit(1); });
