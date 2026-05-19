const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, '.chrome-profile');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 清洗 CSV 字串
const escapeCSV = (str) => {
    if (str == null) return '';
    const cleanStr = String(str).replace(/"/g, '""');
    return `"${cleanStr}"`;
};

// 從列表頁抓取所有 ID
async function getAllIdsFromList(page, listUrl) {
    console.log(`正在前往列表頁面: ${listUrl}`);
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3000);

    // 將每頁顯示筆數設為最大 (200)，減少換頁次數
    await page.evaluate(() => {
        const pSize = document.querySelector('input[name="ele_PageControl_PageSize"]');
        if (pSize) pSize.value = "200";
    });

    // 點擊查詢按鈕
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="button"], button'));
        const searchBtn = btns.find(b => b.value === '查詢' || (b.innerText && b.innerText.includes('查詢')));
        if (searchBtn) searchBtn.click();
    });
    console.log('已送出查詢，等待結果載入...');
    await sleep(5000);

    let allIds = new Set();
    let hasNextPage = true;

    while (hasNextPage) {
        // 抓取當前頁面的所有 ID (從 Checkbox 中)
        const ids = await page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"].chk_Selected');
            return Array.from(checkboxes)
                .map(cb => cb.value)
                .filter(val => val && val !== 'on'); // 過濾掉全選的 on
        });

        // 檢查是否有新的 ID，如果完全沒有增加，代表可能卡在最後一頁無限迴圈
        const previousSize = allIds.size;
        ids.forEach(id => allIds.add(id));
        
        if (allIds.size === previousSize) {
            console.log('  ⚠️ 沒有發現新的資料，停止翻頁。');
            break;
        }

        console.log(`  目前已找到 ${allIds.size} 筆資料...`);

        // 檢查並點擊下一頁
        hasNextPage = await page.evaluate(() => {
            const nextBtn = document.querySelector('#btn_PageControl_PageNext');
            // 如果下一頁按鈕存在且未被停用 (在舊系統中，有時候是直接隱藏或 disable)
            if (nextBtn && !nextBtn.disabled && nextBtn.style.display !== 'none' && !nextBtn.className.includes('disabled')) {
                nextBtn.click();
                return true;
            }
            return false;
        });

        if (hasNextPage) {
            console.log('  自動翻到下一頁...');
            await sleep(4000);
        }
    }

    return Array.from(allIds);
}

// 進入詳細頁面抓取所有資料
async function scrapeDetails(page, editUrlBase, id) {
    const url = `${editUrlBase}?id=${id}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1500); // 等待資料帶入

    const data = await page.evaluate(() => {
        const result = {};
        // 抓取所有帶有 fieldname 屬性的輸入框 (input, textarea, select)
        const elements = document.querySelectorAll('[fieldname]');
        elements.forEach(el => {
            const field = el.getAttribute('fieldname');
            if (!field) return;
            
            let value = '';
            if (el.tagName === 'INPUT') {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    value = el.checked ? '1' : '0';
                } else {
                    value = el.value || '';
                }
            } else if (el.tagName === 'TEXTAREA') {
                value = el.value || '';
            } else if (el.tagName === 'SELECT') {
                const selected = el.options[el.selectedIndex];
                value = selected ? selected.text : '';
            }
            // 保存至結果 (如果有多個同名 fieldname，以有值的為準)
            if (!result[field] || value) {
                result[field] = value.trim();
            }
        });
        return result;
    });

    return data;
}

(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('🚀 啟動聯絡人爬蟲...');
    const browser = await puppeteer.launch({
        headless: "new",
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // 自動關閉對話框，避免卡住
    page.on('dialog', async dialog => {
        console.log(`[系統提示] 自動關閉對話框: ${dialog.message()}`);
        await dialog.dismiss();
    });

    // 載入登入狀態
    if (fs.existsSync(COOKIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        await page.setCookie(...saved);
        console.log('已載入登入狀態...');
    }

    // 定義要抓取的目標
    const targets = [
        {
            name: '供應商',
            listUrl: 'http://cck.uparts.info/car2009/supplier_query/',
            editUrlBase: 'http://cck.uparts.info/CAR2009/Supplier_Query_Edit/',
            csvFile: path.join(OUTPUT_DIR, 'scraped_suppliers.csv')
        },
        {
            name: '客戶',
            listUrl: 'http://cck.uparts.info/car2009/customer_query/',
            editUrlBase: 'http://cck.uparts.info/CAR2009/Customer_Query_Edit/',
            csvFile: path.join(OUTPUT_DIR, 'scraped_customers.csv')
        }
    ];

    for (const target of targets) {
        console.log(`\n==================================================`);
        console.log(`開始抓取【${target.name}】資料...`);
        console.log(`==================================================`);
        
        try {
            const ids = await getAllIdsFromList(page, target.listUrl);
            console.log(`\n✅ 共找到 ${ids.length} 筆【${target.name}】，準備逐一讀取詳細資料...`);

            if (ids.length === 0) continue;

            const allData = [];
            // 我們先抓第一筆來取得所有欄位名稱 (headers)
            let headers = new Set(['GUID_ID']); 

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                process.stdout.write(`\r  [${i+1}/${ids.length}] 正在讀取資料... `);
                
                try {
                    const data = await scrapeDetails(page, target.editUrlBase, id);
                    data['GUID_ID'] = id; // 加入原始 ID 備用
                    
                    Object.keys(data).forEach(k => headers.add(k));
                    allData.push(data);
                } catch (err) {
                    console.log(`\n❌ 第 ${i+1} 筆讀取失敗 (${id}): ${err.message}`);
                }
            }

            console.log(`\n✅ 【${target.name}】讀取完成，準備匯出 CSV...`);
            
            // 轉為 CSV
            const headerArray = Array.from(headers);
            let csvContent = "\uFEFF" + headerArray.join(',') + '\n'; // 加上 BOM 讓 Excel 不亂碼

            allData.forEach(row => {
                const csvRow = headerArray.map(header => escapeCSV(row[header]));
                csvContent += csvRow.join(',') + '\n';
            });

            fs.writeFileSync(target.csvFile, csvContent, 'utf8');
            console.log(`🎉 成功匯出至: ${target.csvFile}`);

        } catch (err) {
            console.log(`❌ 處理【${target.name}】時發生錯誤: ${err.message}`);
        }
    }

    await browser.close();
    console.log('\n==================================================');
    console.log('所有爬蟲作業已完成！');
    console.log('您現在可以到 output/ 資料夾中查看 csv 檔案了！');
    console.log('==================================================');

})();
