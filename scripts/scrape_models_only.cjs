/**
 * scrape_models_only.cjs  v5  (正確欄位版)
 * 
 * 確認的正確 DOM 結構（來自 DevTools 診斷）：
 *   搜尋欄:  #ele_search_KeyWord
 *   按鈕:    #btn_search
 *   資料欄（第N列）:
 *     代碼:   ele_detail_N_ccode
 *     名稱:   ele_detail_N_cname
 *     顯示名: ele_detail_N_lable   (注意是 lable 不是 label)
 *     車廠:   ele_detail_N_car_brand
 *   分頁:    #btn_PageControl_PageNext (停用時=最後一頁)
 *            #btn_PageControl_PageFirst (回第一頁)
 *   → 無總筆數顯示，靠翻頁到按鈕 disabled 停止
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile-shorthand');
const OUTPUT_DIR  = path.join(__dirname, '..', 'output');
const TARGET_URL  = 'http://cck2.uparts.info/car2009/Type_Query2/';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'shorthand_models.csv');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitForEnter(prompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(prompt, () => { rl.close(); resolve(); }));
}

// 讀取當前頁面的資料列（使用正確的 ele_detail_N_ccode 格式）
async function readPageRows(page) {
    return await page.evaluate(() => {
        const rows = [];
        for (let i = 1; i <= 200; i++) {
            const codeEl = document.getElementById(`ele_detail_${i}_ccode`);
            if (!codeEl) {
                // 若連續 3 列都找不到就停
                const check2 = document.getElementById(`ele_detail_${i+1}_ccode`);
                const check3 = document.getElementById(`ele_detail_${i+2}_ccode`);
                if (!check2 && !check3) break;
                continue;
            }
            const code    = codeEl.value.trim();
            const cname   = (document.getElementById(`ele_detail_${i}_cname`)?.value || '').trim();
            const lable   = (document.getElementById(`ele_detail_${i}_lable`)?.value || '').trim();
            const brand   = (document.getElementById(`ele_detail_${i}_car_brand`)?.value || '').trim();
            // 代碼 = ccode, 顯示名 = cname（車型全名）, 廠牌 = car_brand
            if (code) rows.push([code, cname, brand]);
        }
        return rows;
    });
}

// 檢查「下一頁」是否仍可點擊
async function hasNextPage(page) {
    return await page.evaluate(() => {
        const btn = document.getElementById('btn_PageControl_PageNext');
        if (!btn) return false;
        return !btn.disabled && btn.style.display !== 'none' &&
               window.getComputedStyle(btn).display !== 'none' &&
               !btn.classList.contains('disabled');
    });
}

// 前往第一頁
async function goFirstPage(page) {
    await page.evaluate(() => {
        const btn = document.getElementById('btn_PageControl_PageFirst');
        if (btn) btn.click();
    });
    await sleep(2000);
}

// 翻到下一頁
async function goNextPage(page) {
    await page.evaluate(() => {
        const btn = document.getElementById('btn_PageControl_PageNext');
        if (btn) btn.click();
    });
    await sleep(2500);
}

// 取得目前頁碼
async function getCurrentPage(page) {
    return await page.evaluate(() => {
        const el = document.getElementById('ele_PageControl_PageNum');
        return el ? parseInt(el.value) || 1 : 1;
    });
}

// 執行查詢
async function doSearch(page, keyword) {
    // 1. 先回到第一頁避免狀態殘留
    await page.evaluate(() => {
        const btn = document.getElementById('btn_PageControl_PageFirst');
        if (btn) btn.click();
    });
    await sleep(500);

    // 2. 填入搜尋關鍵字
    await page.evaluate((kw) => {
        const inp = document.getElementById('ele_search_KeyWord');
        if (inp) {
            inp.value = kw;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, keyword);
    await sleep(200);

    // 3. 按查詢按鈕
    await page.evaluate(() => {
        const btn = document.getElementById('btn_search');
        if (btn) btn.click();
    });

    await sleep(3000);
}

// 抓取某個查詢的全部頁面資料
async function fetchAllPagesForQuery(page, allData, seenCodes) {
    let pageNum = 1;
    let totalAdded = 0;

    while (true) {
        const rows = await readPageRows(page);
        let added = 0;
        for (const [code, cname, brand] of rows) {
            if (code && !seenCodes.has(code.toLowerCase())) {
                seenCodes.add(code.toLowerCase());
                allData.push([code, cname, brand]);
                added++;
                totalAdded++;
            }
        }
        if (pageNum > 1) process.stdout.write(`(頁${pageNum}:+${added}) `);

        const hasNext = await hasNextPage(page);
        if (!hasNext) break;

        pageNum++;
        await goNextPage(page);
    }

    return totalAdded;
}

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('==================================================');
    console.log('🚗  A. 車型片語表  完整爬蟲 v5 (正確欄位版)');
    console.log('==================================================\n');

    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 },
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    const allData   = [];
    const seenCodes = new Set();

    try {
        console.log('🔑 前往車型片語頁面...');
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await sleep(2000);

        const currentUrl = page.url();
        if (currentUrl.toLowerCase().includes('login') || currentUrl.includes('SERVICE_CENTER')) {
            console.log('\n⚠️  請在瀏覽器中完成登入後按 Enter...');
            await waitForEnter('登入後按 Enter：');
            await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });
            await sleep(2000);
        }
        console.log(`✅ 已在: ${await page.title()}\n`);

        // ── 步驟 1：空值查詢（先確認結構正確性）──
        console.log('【步驟1】空值查詢（確認欄位結構）...');
        await doSearch(page, '');
        const sample = await readPageRows(page);
        console.log(`  → 第一頁讀到 ${sample.length} 列`);
        if (sample.length > 0) {
            console.log(`  → 樣本前 3 筆:`, sample.slice(0, 3));
        }

        // 若空值有資料，翻頁全撈
        if (sample.length > 0) {
            for (const row of sample) {
                const [code] = row;
                if (code && !seenCodes.has(code.toLowerCase())) {
                    seenCodes.add(code.toLowerCase()); allData.push(row);
                }
            }
            // 繼續翻後續頁（連續 3 頁 +0 就停止，因為按鈕不會 disabled）
            let pg = 1;
            let zeroStreak = 0;
            while (zeroStreak < 3) {
                pg++;
                await goNextPage(page);
                process.stdout.write(`  翻頁 ${pg}... `);
                const rows = await readPageRows(page);
                let added = 0;
                for (const row of rows) {
                    const [code] = row;
                    if (code && !seenCodes.has(code.toLowerCase())) {
                        seenCodes.add(code.toLowerCase()); allData.push(row); added++;
                    }
                }
                console.log(`+${added} (共 ${allData.length})`);
                if (added === 0) zeroStreak++; else zeroStreak = 0;
            }
            console.log(`\n  空值查詢完成，共 ${allData.length} 筆`);
        }

        // ── 輸出 CSV ──
        const finalCount = allData.length;
        console.log(`\n✅ 完成！共 ${finalCount} 筆不重複車型片語`);

        const esc = v => {
            const s = String(v ?? '').trim();
            return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
            ['代碼', '顯示名', '廠牌'].join(','),
            ...allData.map(([code, cname, brand]) => [code, cname, brand].map(esc).join(','))
        ];
        fs.writeFileSync(OUTPUT_FILE, '\uFEFF' + lines.join('\n'), 'utf8');
        console.log(`📁 已儲存：${OUTPUT_FILE}`);

        console.log('\n📊 前 30 筆預覽：');
        allData.slice(0, 30).forEach(([code, name, brand], i) =>
            console.log(`  ${String(i + 1).padStart(3)}. [${(code + '          ').slice(0, 8)}] ${name}  (${brand})`)
        );

        await waitForEnter('\n✅ 請確認資料後按 Enter 關閉瀏覽器...');

    } catch (err) {
        console.error('\n❌ 錯誤：', err.message);
        console.error(err.stack);
    } finally {
        await browser.close();
        console.log('\n🎉 爬蟲結束！');
    }
})();
