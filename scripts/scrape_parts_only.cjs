/**
 * scrape_parts_only.cjs
 * B. 品名片語表 (Chname_Query2) 完整爬蟲
 * 
 * 根據車型爬蟲確認的 DOM 結構：
 *   搜尋欄:  #ele_search_KeyWord
 *   按鈕:    #btn_search
 *   翻頁:    #btn_PageControl_PageNext
 *   資料欄 (第N列): ele_detail_N_xxxx
 *   → 先做欄位診斷，印出實際 ID，再全量爬取
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile-shorthand');
const OUTPUT_DIR  = path.join(__dirname, '..', 'output');
const TARGET_URL  = 'http://cck.uparts.info/car2009/Chname_Query2/';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'shorthand_parts.csv');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function waitForEnter(prompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(prompt, () => { rl.close(); resolve(); }));
}

// 診斷：印出第一列所有 input 欄位 ID
async function diagnoseFields(page) {
    const fields = await page.evaluate(() => {
        const result = [];
        // 找所有 ele_detail_1_xxx 格式的 input
        Array.from(document.querySelectorAll('input[id^="ele_detail_1_"]')).forEach(el => {
            result.push({ id: el.id, value: el.value });
        });
        // 若沒找到，改掃 tbody 第一個 tr 的 input
        if (result.length === 0) {
            const trs = document.querySelectorAll('tbody tr');
            if (trs[0]) {
                Array.from(trs[0].querySelectorAll('input[type="text"]')).forEach(el => {
                    result.push({ id: el.id, name: el.name, value: el.value });
                });
            }
        }
        return result;
    });
    console.log('  📋 第一列欄位診斷:', fields);
    return fields;
}

// 根據診斷結果決定讀取欄位
async function readPageRows(page, fieldMap) {
    return await page.evaluate((fm) => {
        const rows = [];
        for (let i = 1; i <= 200; i++) {
            // 用 codeField 確認該列存在
            const codeEl = document.getElementById(`ele_detail_${i}_${fm.code}`);
            if (!codeEl) {
                const c2 = document.getElementById(`ele_detail_${i+1}_${fm.code}`);
                const c3 = document.getElementById(`ele_detail_${i+2}_${fm.code}`);
                if (!c2 && !c3) break;
                continue;
            }
            const getV = (field) => {
                if (!field) return '';
                const e = document.getElementById(`ele_detail_${i}_${field}`);
                return e ? (e.value || '').trim() : '';
            };
            const code     = getV(fm.code);
            const fullname = getV(fm.fullname);
            const extra    = getV(fm.extra);
            if (code) rows.push([code, fullname, extra]);
        }
        return rows;
    }, fieldMap);
}

// 執行查詢
async function doSearch(page, keyword) {
    await page.evaluate((kw) => {
        const inp = document.getElementById('ele_search_KeyWord');
        if (inp) {
            inp.value = kw;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, keyword);
    await sleep(200);
    await page.evaluate(() => {
        const btn = document.getElementById('btn_search');
        if (btn) btn.click();
    });
    await sleep(3000);
}

// 翻到下一頁
async function goNextPage(page) {
    await page.evaluate(() => {
        const btn = document.getElementById('btn_PageControl_PageNext');
        if (btn) btn.click();
    });
    await sleep(2500);
}

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('==================================================');
    console.log('🔧  B. 品名片語表  完整爬蟲');
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
        console.log('🔑 前往品名片語頁面...');
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

        // ── 步驟 1：空值查詢 + 診斷欄位 ──
        console.log('【步驟1】空值查詢並診斷欄位結構...');
        await doSearch(page, '');
        const fields = await diagnoseFields(page);

        // 根據診斷結果設定 fieldMap（自動猜測）
        // 品名片語表可能是: ccode/cname/category 或類似結構
        let fieldMap = { code: 'ccode', fullname: 'cname', extra: 'category' };

        // 若診斷有結果，從 ID 中萃取欄位名稱
        if (fields.length >= 2) {
            const ids = fields.map(f => f.id.replace('ele_detail_1_', ''));
            console.log(`  → 偵測到欄位: [${ids.join(', ')}]`);
            // 猜測：第1個是代碼，第2個是顯示名，第3個是分類
            fieldMap = {
                code:     ids[0] || 'ccode',
                fullname: ids[1] || 'cname',
                extra:    ids[2] || ''
            };
        }
        console.log(`  → 使用 fieldMap:`, fieldMap);

        // 讀第一頁
        const sample = await readPageRows(page, fieldMap);
        console.log(`  → 第一頁讀到 ${sample.length} 列`);
        if (sample.length > 0) console.log(`  → 前 3 筆:`, sample.slice(0, 3));

        // ── 步驟 2：翻頁全撈 ──
        if (sample.length > 0) {
            for (const row of sample) {
                const [code] = row;
                if (code && !seenCodes.has(code.toLowerCase())) {
                    seenCodes.add(code.toLowerCase()); allData.push(row);
                }
            }
            let pg = 1;
            let zeroStreak = 0;
            while (zeroStreak < 3) {
                pg++;
                await goNextPage(page);
                process.stdout.write(`  翻頁 ${pg}... `);
                const rows = await readPageRows(page, fieldMap);
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
            console.log(`\n  翻頁完成，共 ${allData.length} 筆`);
        }

        // ── 輸出 CSV ──
        console.log(`\n✅ 完成！共 ${allData.length} 筆不重複品名片語`);

        const esc = v => {
            const s = String(v ?? '').trim();
            return (s.includes(',') || s.includes('"') || s.includes('\n'))
                ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
            ['代碼', '顯示名', '分類'].join(','),
            ...allData.map(([code, name, cat]) => [code, name, cat].map(esc).join(','))
        ];
        fs.writeFileSync(OUTPUT_FILE, '\uFEFF' + lines.join('\n'), 'utf8');
        console.log(`📁 已儲存：${OUTPUT_FILE}`);

        console.log('\n📊 前 30 筆預覽：');
        allData.slice(0, 30).forEach(([code, name, cat], i) =>
            console.log(`  ${String(i + 1).padStart(3)}. [${(code + '          ').slice(0, 8)}] ${name}  (${cat})`)
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
