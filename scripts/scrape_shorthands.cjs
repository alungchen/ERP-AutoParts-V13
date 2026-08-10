const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile-shorthand');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const BASE_URL = 'http://cck.uparts.info/car2009';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function writeCSV(filePath, headers, rows) {
    const escapeCSV = val => {
        const s = String(val ?? '').trim();
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(','), ...rows.map(r => r.map(escapeCSV).join(','))];
    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
    console.log(`  ✓ 成功匯出 ${rows.length} 筆資料至 ${path.basename(filePath)}`);
}

// 從目前頁面讀取所有資料列（透過 input value 方式讀取）
async function readCurrentPageRows(page, colConfig) {
    return await page.evaluate((colConfig) => {
        const results = [];
        // 嘗試使用 ele_detail_{row}_{field} 模式讀取
        let row = 1;
        while (true) {
            const codeEl = document.querySelector(`[id*="detail_${row}_"]`) ||
                           document.querySelector(`[name*="detail_${row}_"]`);
            if (!codeEl) break;

            const rowData = {};
            colConfig.forEach(col => {
                const el = document.querySelector(`#ele_detail_${row}_${col.field}`) ||
                           document.querySelector(`[name="ele_detail_${row}_${col.field}"]`) ||
                           document.querySelector(`input[id$="_${row}_${col.field}"]`);
                rowData[col.key] = el ? (el.value || el.innerText || '').trim() : '';
            });
            results.push(rowData);
            row++;
        }

        // 如果上方方式找不到，改用 tr 表格方式讀取
        if (results.length === 0) {
            const trs = Array.from(document.querySelectorAll('table tr'));
            for (const tr of trs) {
                const tds = Array.from(tr.querySelectorAll('td'));
                if (tds.length < 3) continue;

                // 嘗試從 td 內的 input 讀取值
                const vals = tds.map(td => {
                    const inp = td.querySelector('input[type="text"], input:not([type="checkbox"]):not([type="button"])');
                    return inp ? inp.value.trim() : td.innerText.trim();
                });

                // 過濾掉明顯是標頭的列
                if (vals[0] && /^\d+$/.test(vals[0])) {
                    results.push({ _raw: vals });
                } else if (vals.length >= 3 && vals[1] && vals[1].length > 0 && vals[1] !== '代碼' && vals[1] !== 'Shorthand') {
                    results.push({ _raw: vals });
                }
            }
        }

        return results;
    }, colConfig);
}

async function scrapeShorthands(page, url, name, config) {
    console.log(`\n▶️  開始抓取 [${name}] 片語表...`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (e) {
        console.log(`  ⚠ 頁面載入超時，嘗試繼續...`);
    }
    await sleep(2000);

    // 確認是否還在登入狀態（檢查是否被導向登入頁）
    const currentUrl = page.url();
    if (currentUrl.includes('Login') || currentUrl.includes('login')) {
        console.log(`  ❌ 登入 session 已過期，無法繼續。請重新登入後再執行此腳本。`);
        return;
    }

    // 確認頁面標題含片語關鍵字
    const pageTitle = await page.title().catch(() => '');
    console.log(`  📄 頁面標題: ${pageTitle} (URL: ${page.url()})`);

    const allData = [];
    const seenCodes = new Set();
    
    // 先試用空值查詢一次（某些系統可以空值查全部）
    const searchChars = ['', '%', ...'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\u4e00\u4e8c\u4e09\u56db\u4e94\u767c\u8f2a\u5236\u8a66\u78ba\u53c3\u6d3e\u5e94\u8eca\u5439\u52a0\u7afc\u706b\u5c01\u6cb9\u9580\u5b89\u5168\u8f49\u5411\u7b2c\u524d\u5f8c\u5de6\u53f3\u4e0a\u4e0b\u5916\u5167\u90e8\u6a21\u5200\u6c34\u9ad8\u5c0f\u9762\u9762\u7b2c\u7814'.split('')];
    
    for (const char of searchChars) {
        const label = char === '' ? '(空值)' : `'${char}'`;
        process.stdout.write(`  [${name}] 搜尋 ${label} ... `);

        // 找到搜尋欄位並輸入
        await page.evaluate((c) => {
            // 嘗試多種方式找到查詢輸入框
            const inp = document.querySelector('input#ele_search_code') ||
                        document.querySelector('input[name="ele_search_code"]') ||
                        document.querySelector('input[id*="search"][type="text"]') ||
                        document.querySelector('td.search_td input[type="text"]') ||
                        document.querySelector('input[type="text"]');
            if (inp) {
                inp.value = c;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, char);

        // 按查詢按鈕
        await page.evaluate(() => {
            const btn = document.querySelector('input[value="查詢"]') ||
                        document.querySelector('button[onclick*="query"]') ||
                        Array.from(document.querySelectorAll('input[type="button"]')).find(b => b.value === '查詢') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === '查詢');
            if (btn) btn.click();
        });

        await sleep(3000); // 等待搜尋結果

        // 取得筆數與總頁數
        const { totalRows, totalPages, rowsPerPage } = await page.evaluate(() => {
            const text = document.body.innerText || '';
            // 嘗試匹配「共 XX 筆」「共XX頁」等格式
            const rowMatch = text.match(/共\s*(\d+)\s*筆/);
            const pageMatch = text.match(/共\s*(\d+)\s*頁/);
            const perPageEl = document.querySelector('#ele_PageControl_PageRows') ||
                              document.querySelector('select[name*="page"]');
            const perPage = perPageEl ? parseInt(perPageEl.value) || 10 : 10;
            return {
                totalRows: rowMatch ? parseInt(rowMatch[1]) : 0,
                totalPages: pageMatch ? parseInt(pageMatch[1]) : 1,
                rowsPerPage: perPage
            };
        });

        if (totalRows === 0 && char !== '') {
            console.log(`0 筆`);
            continue;
        }

        let charAdded = 0;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (pageNum > 1) {
                process.stdout.write(`    [${name}] 翻頁到第 ${pageNum}/${totalPages} 頁 ... `);
            }

            // 讀取當前頁所有資料列（使用更通用的方式）
            const rows = await page.evaluate((colFields) => {
                const results = [];
                
                // 方法 1: 嘗試讀取 input 欄位（CCK 系統常用此方式）
                let rowIdx = 1;
                let found = false;
                while (rowIdx <= 200) {
                    // 尋找該列的代碼欄
                    const codeField = colFields[0]; // 第一個欄位通常是代碼
                    const codeEl = document.querySelector(`#ele_detail_${rowIdx}_${codeField}`) ||
                                   document.querySelector(`[id="ele_detail_${rowIdx}_${codeField}"]`);
                    if (!codeEl) {
                        if (rowIdx > 3 && !found) break; // 前幾列都找不到才停
                        rowIdx++;
                        continue;
                    }
                    found = true;
                    const rowData = colFields.map(field => {
                        const el = document.querySelector(`#ele_detail_${rowIdx}_${field}`) ||
                                   document.querySelector(`[id="ele_detail_${rowIdx}_${field}"]`);
                        return el ? (el.value || el.innerText || '').trim() : '';
                    });
                    results.push(rowData);
                    rowIdx++;
                }

                // 方法 2: 如果方法1找不到，改用 table row 方式
                if (results.length === 0) {
                    const trs = Array.from(document.querySelectorAll('tbody tr, table tr'));
                    for (const tr of trs) {
                        const tds = Array.from(tr.querySelectorAll('td'));
                        if (tds.length < 2) continue;
                        const vals = tds.map(td => {
                            const inp = td.querySelector('input[type="text"]');
                            if (inp) return inp.value.trim();
                            // 排除 checkbox 和 button
                            const checkOrBtn = td.querySelector('input[type="checkbox"], input[type="button"], button');
                            if (checkOrBtn && tds.indexOf(td) === 0) return '_checkbox_'; 
                            return td.innerText.replace(/\n/g, ' ').trim();
                        });
                        // 過濾掉標頭和空列
                        if (vals.filter(v => v && v !== '_checkbox_').length >= 2) {
                            const firstVal = vals.find(v => v && v !== '_checkbox_');
                            // 跳過標頭列（通常是中文標題）
                            if (firstVal && !/^(代碼|Shorthand|序號|項次|品名|車型|品牌)$/.test(firstVal)) {
                                results.push(vals);
                            }
                        }
                    }
                }

                return results;
            }, config.colFields);

            for (const cols of rows) {
                let code, display, third;
                
                if (config.useColFields) {
                    // 使用 colFields 讀取時，順序固定
                    [code, display, third] = [cols[0], cols[1], cols[2] || ''];
                } else {
                    // 使用 table row 讀取時，找到有效欄位
                    const validCols = cols.filter(c => c && c !== '_checkbox_');
                    if (validCols.length < 2) continue;
                    // 序號通常是第1欄，代碼是第2欄，顯示名是第4欄（根據截圖）
                    const nonNumCols = validCols.filter(c => !/^\d+$/.test(c));
                    code = nonNumCols[0] || '';
                    display = nonNumCols[1] || '';
                    third = nonNumCols[2] || '';
                }

                if (code && display && !seenCodes.has(code.toLowerCase())) {
                    seenCodes.add(code.toLowerCase());
                    allData.push([code, display, third]);
                    charAdded++;
                }
            }

            if (pageNum > 1) console.log(`找到 ${rows.length} 列`);

            // 翻到下一頁
            if (pageNum < totalPages) {
                await page.evaluate(() => {
                    const nextBtn = document.querySelector('#btn_PageControl_PageNext') ||
                                   document.querySelector('[id*="PageNext"]') ||
                                   document.querySelector('input[value="下頁"], input[value="下一頁"]');
                    if (nextBtn) nextBtn.click();
                });
                await sleep(2500);
            }
        }

        console.log(`找到 ${charAdded} 筆新資料 (累計 ${allData.length} 筆)`);

        // 如果空值查詢就找到大量資料，代表空值可以查全部，直接結束搜尋
        if (char === '' && charAdded > 5) {
            console.log(`  💡 空值查詢有效，已取得完整資料，略過其餘字元搜尋。`);
            break;
        }
        // 如果 % 查詢有效
        if (char === '%' && charAdded > 5) {
            console.log(`  💡 萬用字元 % 查詢有效，已取得完整資料，略過其餘字元搜尋。`);
            break;
        }
    }
    
    console.log(`✅ [${name}] 共計抓取 ${allData.length} 筆不重複資料。`);
    
    // 輸出 CSV
    const csvPath = path.join(OUTPUT_DIR, config.filename);
    writeCSV(csvPath, config.headers, allData);
}

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    console.log('==================================================');
    console.log('🤖 AI 自動化任務：擷取片語資料 (Shorthands) v2');
    console.log('==================================================\n');

    if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 900 },
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    try {
        // 先訪問登入頁面，讓使用者確認登入狀態
        console.log('🔑 正在確認登入狀態...');
        await page.goto(`${BASE_URL}/Default/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);

        const isLoggedIn = await page.evaluate(() => {
            return !document.body.innerText.includes('登入') && 
                   !document.body.innerText.includes('Login') &&
                   (document.querySelector('a[href*="Logout"]') !== null || 
                    document.body.innerText.includes('系統登出'));
        });

        if (!isLoggedIn) {
            console.log('\n⚠️  您尚未登入！請在彈出的瀏覽器視窗中登入，完成後請按 Enter 繼續...');
            await page.goto(`${BASE_URL}/Default/`, { waitUntil: 'domcontentloaded' });
            // 等待使用者手動登入
            await new Promise(resolve => {
                process.stdin.once('data', resolve);
                console.log('登入完成後按 Enter...');
            });
        } else {
            console.log('✅ 已確認登入狀態！\n');
        }

        // A. 車型片語表
        await scrapeShorthands(page, `${BASE_URL}/Type_Query2/`, '車型片語', {
            filename: 'shorthand_models.csv',
            headers: ['代碼', '顯示名', '廠牌'],
            colFields: ['code', 'fullname', 'brand'],
            useColFields: false
        });

        // B. 品名片語表（正確 URL 是 Chname_Query2）
        await scrapeShorthands(page, `${BASE_URL}/Chname_Query2/`, '品名片語', {
            filename: 'shorthand_parts.csv',
            headers: ['代碼', '顯示名', '分類'],
            colFields: ['code', 'fullname', 'category'],
            useColFields: false
        });

        // C. 品牌片語表
        await scrapeShorthands(page, `${BASE_URL}/Brand_Query2/`, '品牌片語', {
            filename: 'shorthand_brands.csv',
            headers: ['代碼', '顯示名', '備註'],
            colFields: ['code', 'fullname', 'remark'],
            useColFields: false
        });

    } catch (err) {
        console.error('\n❌ 抓取過程中發生錯誤：', err.message);
        console.error(err.stack);
    } finally {
        await browser.close();
        console.log('\n==================================================');
        console.log('🎉 所有片語資料擷取完畢！');
        console.log('👉 請到「系統片語設定」頁面，點擊【匯入表格】按鈕');
        console.log('👉 分別匯入 output 資料夾中的：');
        console.log('   - shorthand_models.csv  (車型片語)');
        console.log('   - shorthand_parts.csv   (品名片語)');
        console.log('   - shorthand_brands.csv  (品牌片語)');
        console.log('==================================================');
    }
})();
